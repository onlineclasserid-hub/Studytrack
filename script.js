// Main Application Controller
class StudyTrackerApp {
    constructor() {
        this.state = {
            currentTab: 'home',
            userName: 'লেওরা',
            avatarColor: '#6c63ff',
            homeText: '"কুত্তার বাইচ্চা টাইম শেষ ওই যার ফড়াত ব!! ১বছরে শেষ না করলে মারা"',
            footerText: 'Developed by আরাফাত',
            challengeTimer: {
                running: false,
                totalSeconds: 0,
                remainingSeconds: 0,
                startTime: null,
                endTime: null,
                topic: '',
                days: 0
            },
            studyTimer: {
                running: false,
                studyTime: 25 * 60,
                breakTime: 5 * 60,
                currentTime: 25 * 60,
                sessions: 4,
                currentSession: 1,
                isStudyTime: true,
                totalSessionsCompleted: 0,
                dailyGoal: 2 * 60 * 60, // 2 hours in seconds
                goalReached: false
            },
            settings: {
                theme: 'default',
                ringtone: 'alarm3',
                volume: 50,
                notifications: true,
                soundEffects: true,
                animations: true,
                autoBackup: true,
                timezone: 'auto',
                autoStartBreak: true,
                typingEffect: true
            },
            topics: [],
            events: [],
            routines: [],
            studyHistory: [],
            // Screen Time removed as requested
            notifications: [],
            dailyRoutine: {
                privateDays: 0,
                collegeDays: 0,
                missedDays: 0,
                monthlyGoalPrivate: 12,
                monthlyGoalCollege: 26
            }
        };
        
        this.challengeTimerInterval = null;
        this.studyTimerInterval = null;
        this.clockInterval = null;
        this.typingInterval = null;
        
        this.init();
    }

    init() {
        this.loadState();
        this.setupEventListeners();
        this.initializeUI();
        this.setupServiceWorker();
        this.showCalendarPopup();
        this.startClock();
        this.setupDeviceTimeSync();
        this.updateAllDisplays();
    }

    loadState() {
        try {
            const saved = localStorage.getItem('study-tracker-state');
            if (saved) {
                const parsed = JSON.parse(saved);
                
                // Merge with current state
                this.state = {
                    ...this.state,
                    ...parsed,
                    // Ensure arrays exist
                    topics: parsed.topics || [],
                    events: parsed.events || [],
                    routines: parsed.routines || [],
                    studyHistory: parsed.studyHistory || [],
                    // Screen Time removed
                    notifications: parsed.notifications || []
                };
                
                // Restore user name if exists
                if (parsed.userName) {
                    this.state.userName = parsed.userName;
                }
                if (parsed.avatarColor) {
                    this.state.avatarColor = parsed.avatarColor;
                }
                if (parsed.homeText) {
                    this.state.homeText = parsed.homeText;
                }
                if (parsed.footerText) {
                    this.state.footerText = parsed.footerText;
                }
                
                // Restore running timers
                if (this.state.challengeTimer.running && this.state.challengeTimer.endTime) {
                    const now = Date.now();
                    const end = new Date(this.state.challengeTimer.endTime).getTime();
                    if (end > now) {
                        this.state.challengeTimer.remainingSeconds = Math.floor((end - now) / 1000);
                        this.startChallengeTimer();
                    } else {
                        this.state.challengeTimer.running = false;
                        this.showNotification('চ্যালেঞ্জ টাইমার শেষ হয়েছে!', 'success');
                    }
                }
                
                if (this.state.studyTimer.running) {
                    const lastUpdate = localStorage.getItem('study-timer-last-update');
                    if (lastUpdate) {
                        const elapsed = Math.floor((Date.now() - parseInt(lastUpdate)) / 1000);
                        this.state.studyTimer.currentTime = Math.max(0, this.state.studyTimer.currentTime - elapsed);
                        if (this.state.studyTimer.currentTime > 0) {
                            this.startStudyTimer();
                        } else {
                            this.handleStudyTimerComplete();
                        }
                    }
                }
                
                console.log('State loaded successfully');
            }
        } catch (e) {
            console.error('Failed to load state:', e);
            this.showNotification('ডেটা লোড করতে সমস্যা হয়েছে', 'error');
        }
    }

    saveState() {
        try {
            localStorage.setItem('study-tracker-state', JSON.stringify(this.state));
            if (this.state.studyTimer.running) {
                localStorage.setItem('study-timer-last-update', Date.now().toString());
            }
            
            // Auto backup
            if (this.state.settings.autoBackup) {
                this.createBackup();
            }
        } catch (e) {
            console.error('Failed to save state:', e);
        }
    }

    createBackup() {
        const backup = {
            ...this.state,
            timestamp: new Date().toISOString()
        };
        localStorage.setItem('study-tracker-backup', JSON.stringify(backup));
    }

    setupEventListeners() {
        // Navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const tab = item.dataset.tab;
                this.switchTab(tab);
            });
        });

        // Logo click to home
        document.getElementById('logo-home').addEventListener('click', () => {
            this.switchTab('home');
        });

        // Challenge timer
        document.getElementById('start-challenge').addEventListener('click', () => this.setupChallenge());
        document.getElementById('start-challenge-timer').addEventListener('click', () => this.startChallengeTimer());
        document.getElementById('stop-challenge-timer').addEventListener('click', () => this.stopChallengeTimer());
        document.getElementById('edit-challenge').addEventListener('click', () => this.editChallenge());

        // Study timer
        document.getElementById('pomodoro-start').addEventListener('click', () => this.startStudyTimer());
        document.getElementById('pomodoro-pause').addEventListener('click', () => this.pauseStudyTimer());
        document.getElementById('pomodoro-reset').addEventListener('click', () => this.resetStudyTimer());
        document.getElementById('pomodoro-skip').addEventListener('click', () => this.skipStudySession());
        document.getElementById('apply-pomodoro').addEventListener('click', () => this.applyPomodoroSettings());
        document.getElementById('edit-daily-goal').addEventListener('click', () => this.editDailyGoal());

        // Settings
        document.querySelectorAll('.theme-select').forEach(select => {
            select.addEventListener('click', () => this.setTheme(select.dataset.theme));
        });

        document.querySelectorAll('.theme-option').forEach(option => {
            option.addEventListener('click', () => this.setTheme(option.dataset.theme));
        });

        document.getElementById('apply-theme').addEventListener('click', () => this.applyThemeSettings());
        document.getElementById('save-timer-settings').addEventListener('click', () => this.saveTimerSettings());
        document.getElementById('save-ringtone').addEventListener('click', () => this.saveRingtoneSettings());
        document.getElementById('add-topic').addEventListener('click', () => this.addTopic());
        document.getElementById('clear-topics').addEventListener('click', () => this.clearTopics());
        document.getElementById('save-home-text').addEventListener('click', () => this.saveHomeText());
        document.getElementById('export-data').addEventListener('click', () => this.exportData());
        document.getElementById('import-data').addEventListener('click', () => this.importData());
        document.getElementById('clear-data').addEventListener('click', () => this.clearData());
        document.getElementById('sync-device-time').addEventListener('click', () => this.syncDeviceTime());
        document.getElementById('check-updates').addEventListener('click', () => this.checkUpdates());
        document.getElementById('report-bug').addEventListener('click', () => this.reportBug());
        document.getElementById('share-app').addEventListener('click', () => this.shareApp());

        // Ringtone preview
        document.querySelectorAll('.preview-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const ringtone = e.target.closest('.ringtone-select').dataset.ringtone;
                this.previewRingtone(ringtone);
            });
        });

        // Ringtone selection
        document.querySelectorAll('.ringtone-select').forEach(select => {
            select.addEventListener('click', (e) => {
                if (e.target.classList.contains('preview-btn')) return;
                const ringtone = select.dataset.ringtone;
                this.selectRingtone(ringtone);
            });
        });

        // Volume control
        document.getElementById('alarm-volume').addEventListener('input', (e) => {
            const volume = e.target.value;
            document.getElementById('volume-value').textContent = `${volume}%`;
            this.state.settings.volume = parseInt(volume);
            this.saveState();
        });

        // Calendar popup
        document.getElementById('close-calendar-popup').addEventListener('click', () => this.hideCalendarPopup());

        // Topic modal
        document.getElementById('add-topic-btn').addEventListener('click', () => this.showAddTopicModal());
        document.querySelectorAll('.close-modal').forEach(closeBtn => {
            closeBtn.addEventListener('click', function() {
                this.closest('.modal').style.display = 'none';
            });
        });
        document.getElementById('save-new-topic').addEventListener('click', () => this.saveNewTopic());

        // Icon selection
        document.querySelectorAll('.icon-option').forEach(icon => {
            icon.addEventListener('click', function() {
                document.querySelectorAll('.icon-option').forEach(i => i.classList.remove('active'));
                this.classList.add('active');
            });
        });

        // Daily routine
        document.getElementById('prev-month').addEventListener('click', () => this.changeMonth(-1));
        document.getElementById('next-month').addEventListener('click', () => this.changeMonth(1));
        document.getElementById('add-routine').addEventListener('click', () => this.showAddRoutineModal());
        document.getElementById('save-routine-settings').addEventListener('click', () => this.saveRoutineSettings());

        // Calendar
        document.getElementById('calendar-prev').addEventListener('click', () => this.changeCalendarMonth(-1));
        document.getElementById('calendar-next').addEventListener('click', () => this.changeCalendarMonth(1));
        document.getElementById('add-event-btn').addEventListener('click', () => this.showAddEventModal());
        document.getElementById('save-event').addEventListener('click', () => this.saveEvent());

        // Color selection
        document.querySelectorAll('.color-option').forEach(color => {
            color.addEventListener('click', function() {
                document.querySelectorAll('.color-option').forEach(c => c.classList.remove('active'));
                this.classList.add('active');
            });
        });

        // History filters
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const filter = e.target.dataset.filter;
                this.filterHistory(filter);
            });
        });

        document.getElementById('apply-date-range').addEventListener('click', () => this.applyDateRange());

        // Profile Edit
        document.getElementById('save-profile').addEventListener('click', () => this.saveProfile());
        document.getElementById('edit-profile-btn').addEventListener('click', () => this.showProfileEditModal());
        document.getElementById('save-profile-changes').addEventListener('click', () => this.saveProfileChanges());

        // Window events
        window.addEventListener('beforeunload', () => this.saveState());
        window.addEventListener('unload', () => this.saveState());

        // Visibility change
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                this.updateAllTimers();
            }
        });

        // Online/offline
        window.addEventListener('online', () => {
            document.getElementById('online-status').textContent = 'হ্যাঁ';
            this.syncData();
        });
        window.addEventListener('offline', () => {
            document.getElementById('online-status').textContent = 'না';
            this.showNotification('ইন্টারনেট সংযোগ নেই', 'warning');
        });

        // Close modals on outside click
        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                e.target.style.display = 'none';
            }
        });

        // Initialize Flatpickr
        this.setupDatePickers();
    }

    initializeUI() {
        // Set initial theme
        this.applyTheme(this.state.settings.theme);

        // Initially hide all non-active tabs
        document.querySelectorAll('.tab-pane').forEach(pane => {
            if (!pane.classList.contains('active')) {
                pane.style.display = 'none';
            } else {
                pane.style.display = 'block';
            }
        });

        // Update all displays
        this.updateAllDisplays();

        // Load topics
        this.renderTopics();

        // Load events
        this.updateCalendar();

        // Load routines
        this.updateRoutineCalendar();

        // Setup charts
        this.initializeCharts();

        // Update stats
        this.updateStats();

        // Typing effect
        if (this.state.settings.typingEffect) {
            this.startTypingEffect();
        }

        // Set initial values
        this.setInitialValues();

        // Update user profile
        this.updateUserProfile();
    }

    setInitialValues() {
        // Set volume slider
        document.getElementById('alarm-volume').value = this.state.settings.volume;
        document.getElementById('volume-value').textContent = `${this.state.settings.volume}%`;

        // Set theme selects
        document.querySelectorAll('.theme-select').forEach(select => {
            select.classList.remove('active');
            if (select.dataset.theme === this.state.settings.theme) {
                select.classList.add('active');
            }
        });

        // Set ringtone selects
        document.querySelectorAll('.ringtone-select').forEach(select => {
            select.classList.remove('active');
            if (select.dataset.ringtone === this.state.settings.ringtone) {
                select.classList.add('active');
            }
        });

        // Set toggles
        document.getElementById('notifications').checked = this.state.settings.notifications;
        document.getElementById('sound-effects').checked = this.state.settings.soundEffects;
        document.getElementById('animations').checked = this.state.settings.animations;
        document.getElementById('auto-backup').checked = this.state.settings.autoBackup;
        document.getElementById('auto-start-break').checked = this.state.settings.autoStartBreak;
        document.getElementById('typing-effect').checked = this.state.settings.typingEffect;

        // Set timezone
        document.getElementById('timezone-select').value = this.state.settings.timezone;

        // Set daily routine settings
        document.getElementById('private-per-month').value = this.state.dailyRoutine.monthlyGoalPrivate;
        document.getElementById('college-per-month').value = this.state.dailyRoutine.monthlyGoalCollege;

        // Set study timer settings
        document.getElementById('pomodoro-study').value = this.state.studyTimer.studyTime / 60;
        document.getElementById('pomodoro-break').value = this.state.studyTimer.breakTime / 60;
        document.getElementById('pomodoro-sessions').value = this.state.studyTimer.sessions;
        document.getElementById('daily-study-goal').value = this.state.studyTimer.dailyGoal / 3600;
        document.getElementById('study-duration').value = this.state.studyTimer.studyTime / 60;
        document.getElementById('break-duration').value = this.state.studyTimer.breakTime / 60;

        // Set home text
        document.getElementById('home-text').value = this.state.homeText;
        document.getElementById('footer-text').value = this.state.footerText;

        // Set user name
        document.getElementById('user-name').value = this.state.userName;
        document.getElementById('user-avatar-color').value = this.state.avatarColor;
    }

    updateUserProfile() {
        // Update sidebar name
        document.getElementById('user-name-display').textContent = this.state.userName;
        
        // Update avatar color
        document.querySelector('.avatar').style.backgroundColor = this.state.avatarColor;
        document.querySelector('.avatar').style.color = this.getContrastColor(this.state.avatarColor);
    }

    getContrastColor(hexcolor) {
        // Remove # if present
        hexcolor = hexcolor.replace("#", "");
        
        // Convert to RGB
        const r = parseInt(hexcolor.substr(0, 2), 16);
        const g = parseInt(hexcolor.substr(2, 2), 16);
        const b = parseInt(hexcolor.substr(4, 2), 16);
        
        // Calculate luminance
        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        
        // Return black or white depending on luminance
        return luminance > 0.5 ? '#000000' : '#ffffff';
    }

    setupServiceWorker() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('service-worker.js')
                .then(registration => {
                    console.log('ServiceWorker registered:', registration.scope);
                })
                .catch(error => {
                    console.log('ServiceWorker registration failed:', error);
                });
        }
    }

    showCalendarPopup() {
        const firstVisit = !localStorage.getItem('first-visit');
        if (firstVisit) {
            setTimeout(() => {
                const popup = document.getElementById('calendar-popup');
                popup.style.display = 'flex';
                
                // Update date/time in popup
                const now = new Date();
                const options = { year: 'numeric', month: 'long', day: 'numeric' };
                document.getElementById('today-date').textContent = now.toLocaleDateString('bn-BD', options);
                document.getElementById('today-day').textContent = now.toLocaleDateString('bn-BD', { weekday: 'long' });
                document.getElementById('today-time').textContent = now.toLocaleTimeString('bn-BD', {
                    hour: '2-digit',
                    minute: '2-digit'
                });

                // Check for upcoming events
                const upcomingEvents = this.getUpcomingEvents(1);
                if (upcomingEvents.length > 0) {
                    document.getElementById('next-event-text').textContent = upcomingEvents[0].title;
                }

                // Auto close after 3 seconds
                setTimeout(() => {
                    this.hideCalendarPopup();
                }, 3000);

                localStorage.setItem('first-visit', 'true');
            }, 1000);
        }
    }

    hideCalendarPopup() {
        const popup = document.getElementById('calendar-popup');
        popup.style.display = 'none';
    }

    startClock() {
        this.updateClock();
        this.clockInterval = setInterval(() => this.updateClock(), 1000);
    }

    updateClock() {
        const now = new Date();
        
        // Header clock with animation
        const headerDate = now.toLocaleDateString('bn-BD', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });
        const headerTime = now.toLocaleTimeString('bn-BD', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
        
        const dateTimeElement = document.getElementById('current-date-time');
        dateTimeElement.textContent = `${headerDate} | ${headerTime}`;
        dateTimeElement.classList.add('time-update-animation');
        
        // Remove animation class after animation completes
        setTimeout(() => {
            dateTimeElement.classList.remove('time-update-animation');
        }, 500);
        
        // Sidebar clock
        const sidebarTime = now.toLocaleTimeString('bn-BD', {
            hour: '2-digit',
            minute: '2-digit'
        });
        const sidebarElement = document.getElementById('current-device-time');
        sidebarElement.textContent = sidebarTime;
        sidebarElement.classList.add('time-update-animation');
        
        setTimeout(() => {
            sidebarElement.classList.remove('time-update-animation');
        }, 500);
        
        // Update device info
        const deviceTimeElement = document.getElementById('device-time-info');
        deviceTimeElement.textContent = now.toLocaleTimeString();
        deviceTimeElement.classList.add('time-update-animation');
        
        setTimeout(() => {
            deviceTimeElement.classList.remove('time-update-animation');
        }, 500);
    }

    setupDeviceTimeSync() {
        // Update device info
        this.updateDeviceInfo();
        
        // Populate timezone select
        const timezoneSelect = document.getElementById('timezone-select');
        const timezones = Intl.supportedValuesOf('timeZone');
        
        timezones.forEach(tz => {
            const option = document.createElement('option');
            option.value = tz;
            option.textContent = tz;
            timezoneSelect.appendChild(option);
        });
    }

    updateDeviceInfo() {
        const now = new Date();
        
        document.getElementById('device-time-info').textContent = 
            now.toLocaleTimeString();
        document.getElementById('device-date-info').textContent = 
            now.toLocaleDateString();
        document.getElementById('device-timezone').textContent = 
            Intl.DateTimeFormat().resolvedOptions().timeZone;
        
        // Browser info
        const ua = navigator.userAgent;
        let browser = "Unknown";
        if (ua.includes("Chrome")) browser = "Chrome";
        else if (ua.includes("Firefox")) browser = "Firefox";
        else if (ua.includes("Safari") && !ua.includes("Chrome")) browser = "Safari";
        else if (ua.includes("Edge")) browser = "Edge";
        
        document.getElementById('browser-info').textContent = browser;
        
        // Online status
        document.getElementById('online-status').textContent = navigator.onLine ? 'হ্যাঁ' : 'না';
    }

    syncDeviceTime() {
        this.updateDeviceInfo();
        this.showNotification('ডিভাইস টাইম সিঙ্ক করা হয়েছে', 'success');
    }

    setupDatePickers() {
        // Initialize date pickers
        const dateInputs = document.querySelectorAll('.date-input');
        dateInputs.forEach(input => {
            flatpickr(input, {
                dateFormat: "Y-m-d",
                altInput: true,
                altFormat: "F j, Y",
                minDate: "today"
            });
        });
    }

    switchTab(tabId) {
        // Update active nav item
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
            if (item.dataset.tab === tabId) {
                item.classList.add('active');
            }
        });

        // Hide all tab panes
        document.querySelectorAll('.tab-pane').forEach(pane => {
            pane.classList.remove('active');
            pane.style.display = 'none';
        });

        const targetTab = document.getElementById(`${tabId}-tab`);
        if (targetTab) {
            // Show the target tab
            targetTab.style.display = 'block';
            // Force reflow
            targetTab.offsetHeight;
            targetTab.classList.add('active');
            
            this.state.currentTab = tabId;

            // Update tab title
            const tabNames = {
                'home': 'হোম',
                'daily-routine': 'ডেইলি রুটিন',
                'calendar': 'ক্যালেন্ডার',
                'study-timer': 'স্টাডি টাইমার',
                'history': 'হিস্টরি',
                'screen-time': 'স্ক্রিন টাইম',
                'settings': 'সেটিংস'
            };
            document.getElementById('current-tab-title').textContent = tabNames[tabId] || 'হোম';

            // Initialize tab-specific features
            switch(tabId) {
                case 'history':
                    this.updateHistoryChart();
                    this.updateHistoryTable();
                    break;
                case 'screen-time':
                    // Screen time tab removed
                    break;
                case 'daily-routine':
                    this.updateRoutineChart();
                    break;
                case 'calendar':
                    this.updateCalendar();
                    break;
                case 'home':
                    this.updateChallengeDisplay();
                    this.renderTopics();
                    // Restart typing effect if on home tab
                    if (this.state.settings.typingEffect) {
                        setTimeout(() => this.startTypingEffect(), 100);
                    }
                    break;
                case 'settings':
                    // Update settings form values
                    this.setInitialValues();
                    break;
            }
            
            this.saveState();
        }
    }

    // Challenge Timer Methods
    setupChallenge() {
        const days = parseInt(document.getElementById('challenge-days').value);
        const topic = document.getElementById('challenge-topic').value.trim();
        const startDate = document.getElementById('challenge-start').value;

        if (!days || days < 1 || days > 365) {
            this.showNotification('দয়া করে ১ থেকে ৩৬৫ দিনের মধ্যে একটি সংখ্যা দিন', 'error');
            return;
        }

        if (!topic) {
            this.showNotification('দয়া করে টপিকের নাম দিন', 'error');
            return;
        }

        if (!startDate) {
            this.showNotification('দয়া তারিখ সিলেক্ট করুন', 'error');
            return;
        }

        const start = new Date(startDate);
        const end = new Date(start);
        end.setDate(start.getDate() + days);

        this.state.challengeTimer = {
            running: false,
            totalSeconds: days * 24 * 60 * 60,
            remainingSeconds: days * 24 * 60 * 60,
            startTime: start,
            endTime: end,
            topic: topic,
            days: days
        };

        this.updateChallengeDisplay();
        this.showNotification(`চ্যালেঞ্জ সেট করা হয়েছে: ${topic} - ${days} দিন`, 'success');
        this.saveState();
    }

    startChallengeTimer() {
        if (this.state.challengeTimer.running) return;
        if (this.state.challengeTimer.remainingSeconds <= 0) {
            this.showNotification('চ্যালেঞ্জ টাইমার শেষ হয়েছে', 'error');
            return;
        }

        this.state.challengeTimer.running = true;
        this.state.challengeTimer.startTime = new Date();
        
        this.challengeTimerInterval = setInterval(() => {
            if (this.state.challengeTimer.remainingSeconds <= 0) {
                this.completeChallenge();
                return;
            }

            this.state.challengeTimer.remainingSeconds--;
            this.updateChallengeDisplay();
        }, 1000);

        this.updateChallengeButtons();
        this.showNotification('চ্যালেঞ্জ টাইমার শুরু হয়েছে!', 'success');
        this.saveState();
    }

    stopChallengeTimer() {
        if (!this.state.challengeTimer.running) return;

        clearInterval(this.challengeTimerInterval);
        this.state.challengeTimer.running = false;
        
        this.updateChallengeButtons();
        this.showNotification('চ্যালেঞ্জ টাইমার থামানো হয়েছে', 'warning');
        this.saveState();
    }

    completeChallenge() {
        clearInterval(this.challengeTimerInterval);
        this.state.challengeTimer.running = false;
        this.state.challengeTimer.remainingSeconds = 0;
        
        this.updateChallengeDisplay();
        this.showNotification('চ্যালেঞ্জ সম্পূর্ণ হয়েছে! অভিনন্দন!', 'success');
        this.playAlarmSound('success');
        
        // Add to history
        this.addToStudyHistory({
            type: 'challenge_complete',
            topic: this.state.challengeTimer.topic,
            duration: this.state.challengeTimer.totalSeconds,
            date: new Date().toISOString(),
            status: 'completed'
        });
        
        this.saveState();
    }

    editChallenge() {
        if (this.state.challengeTimer.running) {
            this.showNotification('চ্যালেঞ্জ চলাকালীন এডিট করা যাবে না', 'error');
            return;
        }

        // Fill form with current challenge data
        document.getElementById('challenge-days').value = this.state.challengeTimer.days || '';
        document.getElementById('challenge-topic').value = this.state.challengeTimer.topic || '';
        
        if (this.state.challengeTimer.startTime) {
            const startDate = new Date(this.state.challengeTimer.startTime);
            const dateStr = startDate.toISOString().split('T')[0];
            document.getElementById('challenge-start').value = dateStr;
        }
        
        this.showNotification('চ্যালেঞ্জ এডিট করতে ফর্ম পূরণ করুন', 'info');
    }

    updateChallengeDisplay() {
        const timer = this.state.challengeTimer;
        
        if (timer.remainingSeconds > 0) {
            const days = Math.floor(timer.remainingSeconds / (24 * 60 * 60));
            const hours = Math.floor((timer.remainingSeconds % (24 * 60 * 60)) / (60 * 60));
            const minutes = Math.floor((timer.remainingSeconds % (60 * 60)) / 60);
            const seconds = timer.remainingSeconds % 60;
            
            document.getElementById('challenge-countdown').textContent = 
                `${days.toString().padStart(2, '0')}:${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            
            const progress = timer.totalSeconds > 0 ? ((timer.totalSeconds - timer.remainingSeconds) / timer.totalSeconds) * 100 : 0;
            document.getElementById('challenge-timer-progress').style.background = 
                `conic-gradient(var(--primary-color) ${progress}%, transparent 0%)`;
        } else {
            document.getElementById('challenge-countdown').textContent = '00:00:00:00';
            document.getElementById('challenge-timer-progress').style.background = 
                `conic-gradient(var(--primary-color) 100%, transparent 0%)`;
        }
        
        document.getElementById('challenge-status').textContent = 
            timer.running ? 'চলছে...' : (timer.remainingSeconds <= 0 ? 'সম্পূর্ণ' : 'বিরতিতে');
        document.getElementById('challenge-topic-display').textContent = 
            timer.topic || 'কোনো টপিক সিলেক্ট করা হয়নি';
        
        this.updateChallengeButtons();
    }

    updateChallengeButtons() {
        const running = this.state.challengeTimer.running;
        const hasChallenge = this.state.challengeTimer.totalSeconds > 0;
        
        document.getElementById('start-challenge-timer').disabled = running || !hasChallenge;
        document.getElementById('stop-challenge-timer').disabled = !running || !hasChallenge;
        document.getElementById('edit-challenge').disabled = running || !hasChallenge;
    }

    // Study Timer Methods
    startStudyTimer() {
        if (this.state.studyTimer.running) return;

        this.state.studyTimer.running = true;
        this.studyTimerInterval = setInterval(() => {
            if (this.state.studyTimer.currentTime <= 0) {
                this.handleStudyTimerComplete();
                return;
            }

            this.state.studyTimer.currentTime--;
            this.updateStudyTimerDisplay();
        }, 1000);

        this.updateStudyTimerButtons();
        this.showNotification('স্টাডি টাইমার শুরু হয়েছে!', 'success');
        this.saveState();
    }

    pauseStudyTimer() {
        if (!this.state.studyTimer.running) return;

        clearInterval(this.studyTimerInterval);
        this.state.studyTimer.running = false;
        
        this.updateStudyTimerButtons();
        this.showNotification('স্টাডি টাইমার পজ করা হয়েছে', 'warning');
        this.saveState();
    }

    resetStudyTimer() {
        clearInterval(this.studyTimerInterval);
        this.state.studyTimer.running = false;
        this.state.studyTimer.currentTime = this.state.studyTimer.studyTime;
        this.state.studyTimer.currentSession = 1;
        this.state.studyTimer.isStudyTime = true;
        
        this.updateStudyTimerDisplay();
        this.updateStudyTimerButtons();
        this.updateSessionsDisplay();
        this.showNotification('স্টাডি টাইমার রিসেট করা হয়েছে', 'info');
        this.saveState();
    }

    skipStudySession() {
        if (this.state.studyTimer.isStudyTime) {
            // Skip to break
            this.state.studyTimer.isStudyTime = false;
            this.state.studyTimer.currentTime = this.state.studyTimer.breakTime;
        } else {
            // Skip to next study session
            this.state.studyTimer.isStudyTime = true;
            this.state.studyTimer.currentTime = this.state.studyTimer.studyTime;
            this.state.studyTimer.currentSession++;
            
            if (this.state.studyTimer.currentSession > this.state.studyTimer.sessions) {
                this.completeAllSessions();
                return;
            }
        }
        
        this.updateStudyTimerDisplay();
        this.updateSessionsDisplay();
        this.playAlarmSound('warning');
        this.showNotification('সেশন স্কিপ করা হয়েছে', 'info');
        this.saveState();
    }

    handleStudyTimerComplete() {
        clearInterval(this.studyTimerInterval);
        
        if (this.state.studyTimer.isStudyTime) {
            // Study session completed
            this.state.studyTimer.isStudyTime = false;
            this.state.studyTimer.currentTime = this.state.studyTimer.breakTime;
            this.state.studyTimer.totalSessionsCompleted++;
            
            // Add to history
            this.addToStudyHistory({
                type: 'study_session',
                duration: this.state.studyTimer.studyTime,
                date: new Date().toISOString(),
                session: this.state.studyTimer.currentSession,
                status: 'completed'
            });
            
            this.showNotification('স্টাডি সেশন শেষ! ব্রেক নিন।', 'success');
            this.playAlarmSound('success');
            
            if (this.state.settings.autoStartBreak) {
                setTimeout(() => this.startStudyTimer(), 1000);
            }
        } else {
            // Break completed
            this.state.studyTimer.isStudyTime = true;
            this.state.studyTimer.currentTime = this.state.studyTimer.studyTime;
            this.state.studyTimer.currentSession++;
            
            if (this.state.studyTimer.currentSession > this.state.studyTimer.sessions) {
                this.completeAllSessions();
                return;
            }
            
            this.showNotification('ব্রেক শেষ! আবার পড়া শুরু করুন।', 'success');
            this.playAlarmSound('success');
            setTimeout(() => this.startStudyTimer(), 1000);
        }
        
        this.updateStudyTimerDisplay();
        this.updateSessionsDisplay();
        this.saveState();
    }

    completeAllSessions() {
        this.state.studyTimer.running = false;
        this.state.studyTimer.currentSession = 1;
        this.state.studyTimer.isStudyTime = true;
        this.state.studyTimer.currentTime = this.state.studyTimer.studyTime;
        
        this.showNotification('সকল সেশন সম্পূর্ণ হয়েছে! অভিনন্দন!', 'success');
        this.playAlarmSound('success');
        
        this.updateStudyTimerDisplay();
        this.updateStudyTimerButtons();
        this.updateSessionsDisplay();
        this.saveState();
    }

    applyPomodoroSettings() {
        const studyTime = parseInt(document.getElementById('pomodoro-study').value) * 60;
        const breakTime = parseInt(document.getElementById('pomodoro-break').value) * 60;
        const sessions = parseInt(document.getElementById('pomodoro-sessions').value);
        const dailyGoal = parseFloat(document.getElementById('daily-study-goal').value) * 60 * 60;
        
        if (studyTime < 300 || studyTime > 7200) {
            this.showNotification('স্টাডি সময় ৫ মিনিট থেকে ২ ঘন্টার মধ্যে হতে হবে', 'error');
            return;
        }
        
        if (breakTime < 60 || breakTime > 1800) {
            this.showNotification('ব্রেক সময় ১ মিনিট থেকে ৩০ মিনিটের মধ্যে হতে হবে', 'error');
            return;
        }
        
        if (sessions < 1 || sessions > 10) {
            this.showNotification('সেশন সংখ্যা ১ থেকে ১০ এর মধ্যে হতে হবে', 'error');
            return;
        }
        
        if (dailyGoal < 1800 || dailyGoal > 43200) {
            this.showNotification('দৈনিক লক্ষ্য ০.৫ ঘন্টা থেকে ১২ ঘন্টার মধ্যে হতে হবে', 'error');
            return;
        }
        
        this.state.studyTimer.studyTime = studyTime;
        this.state.studyTimer.breakTime = breakTime;
        this.state.studyTimer.sessions = sessions;
        this.state.studyTimer.dailyGoal = dailyGoal;
        
        if (!this.state.studyTimer.running) {
            this.state.studyTimer.currentTime = studyTime;
            this.state.studyTimer.currentSession = 1;
            this.state.studyTimer.isStudyTime = true;
        }
        
        this.updateStudyTimerDisplay();
        this.updateSessionsDisplay();
        this.showNotification('টাইমার সেটিংস আপডেট করা হয়েছে', 'success');
        this.saveState();
    }

    editDailyGoal() {
        const newGoal = prompt('নতুন দৈনিক লক্ষ্য দিন (ঘন্টায়):', this.state.studyTimer.dailyGoal / 3600);
        if (newGoal !== null) {
            const goal = parseFloat(newGoal);
            if (!isNaN(goal) && goal >= 0.5 && goal <= 12) {
                this.state.studyTimer.dailyGoal = goal * 3600;
                this.updateStudyTimerDisplay();
                this.showNotification('দৈনিক লক্ষ্য আপডেট করা হয়েছে', 'success');
                this.saveState();
            } else {
                this.showNotification('দয়া করে ০.৫ থেকে ১২ ঘন্টার মধ্যে একটি সংখ্যা দিন', 'error');
            }
        }
    }

    updateStudyTimerDisplay() {
        const timer = this.state.studyTimer;
        
        const minutes = Math.floor(timer.currentTime / 60);
        const seconds = timer.currentTime % 60;
        
        document.getElementById('pomodoro-countdown').textContent = 
            `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        const totalTime = timer.isStudyTime ? timer.studyTime : timer.breakTime;
        const progress = totalTime > 0 ? ((totalTime - timer.currentTime) / totalTime) * 100 : 0;
        document.getElementById('pomodoro-progress').style.background = 
            `conic-gradient(var(--primary-color) ${progress}%, transparent 0%)`;
        
        document.getElementById('pomodoro-status').textContent = 
            timer.isStudyTime ? 'স্টাডি সেশন' : 'ব্রেক টাইম';
        document.getElementById('pomodoro-session').textContent = 
            `সেশন ${timer.currentSession} of ${timer.sessions}`;
        
        // Update daily stats
        const todayStudied = this.getTodayStudyTime();
        const hours = Math.floor(todayStudied / 3600);
        const mins = Math.floor((todayStudied % 3600) / 60);
        document.getElementById('today-studied').textContent = `${hours}h ${mins}m`;
        
        const goalProgress = timer.dailyGoal > 0 ? (todayStudied / timer.dailyGoal) * 100 : 0;
        document.getElementById('daily-progress').style.width = `${Math.min(goalProgress, 100)}%`;
        
        document.getElementById('daily-goal').textContent = 
            `${(timer.dailyGoal / 3600).toFixed(1)} ঘন্টা`;
        document.getElementById('current-session').textContent = timer.currentSession;
        document.getElementById('session-type').textContent = timer.isStudyTime ? 'স্টাডি' : 'ব্রেক';
    }

    updateStudyTimerButtons() {
        const running = this.state.studyTimer.running;
        document.getElementById('pomodoro-start').disabled = running;
        document.getElementById('pomodoro-pause').disabled = !running;
    }

    updateSessionsDisplay() {
        const container = document.getElementById('sessions-container');
        if (!container) return;
        
        container.innerHTML = '';
        
        const totalSessions = this.state.studyTimer.sessions * 2;
        
        for (let i = 1; i <= totalSessions; i++) {
            const sessionDiv = document.createElement('div');
            sessionDiv.className = 'session';
            
            const sessionNumber = Math.ceil(i / 2);
            const isStudy = i % 2 === 1;
            
            if (sessionNumber === this.state.studyTimer.currentSession) {
                if (isStudy === this.state.studyTimer.isStudyTime) {
                    sessionDiv.classList.add('active');
                }
            }
            
            if (sessionNumber < this.state.studyTimer.currentSession) {
                sessionDiv.classList.add('completed');
            }
            
            const numberSpan = document.createElement('span');
            numberSpan.className = 'session-number';
            numberSpan.textContent = sessionNumber;
            
            const typeSpan = document.createElement('span');
            typeSpan.className = 'session-type';
            typeSpan.textContent = isStudy ? 'স্টাডি' : 'ব্রেক';
            
            sessionDiv.appendChild(numberSpan);
            sessionDiv.appendChild(typeSpan);
            container.appendChild(sessionDiv);
        }
    }

    // Theme Methods - Improved for text visibility
    setTheme(theme) {
        this.state.settings.theme = theme;
        this.applyTheme(theme);
        this.showNotification(`থিম পরিবর্তন করা হয়েছে: ${theme}`, 'success');
        this.saveState();
    }

    applyTheme(theme) {
        // Remove all theme classes
        document.body.classList.remove('dark-theme', 'blue-theme', 'green-theme');
        
        // Add selected theme class
        if (theme !== 'default') {
            document.body.classList.add(`${theme}-theme`);
        }
        
        // Update active theme selectors
        document.querySelectorAll('.theme-select').forEach(selector => {
            selector.classList.remove('active');
            if (selector.dataset.theme === theme) {
                selector.classList.add('active');
            }
        });
        
        // Force re-render of all text elements for better visibility
        this.updateTextVisibility();
    }

    updateTextVisibility() {
        // Apply text color based on theme for better visibility
        const textColor = document.getElementById('text-color').value;
        document.documentElement.style.setProperty('--text-color', textColor);
        
        // Update all text elements
        const textElements = document.querySelectorAll('h1, h2, h3, h4, h5, h6, p, span, div, td, th, label');
        textElements.forEach(el => {
            el.style.color = '';
        });
    }

    applyThemeSettings() {
        const textColor = document.getElementById('text-color').value;
        document.documentElement.style.setProperty('--text-color', textColor);
        
        this.showNotification('থিম সেটিংস আপডেট করা হয়েছে', 'success');
        this.saveState();
    }

    saveTimerSettings() {
        const studyDuration = parseInt(document.getElementById('study-duration').value);
        const breakDuration = parseInt(document.getElementById('break-duration').value);
        const autoStartBreak = document.getElementById('auto-start-break').checked;
        
        if (studyDuration < 5 || studyDuration > 120) {
            this.showNotification('স্টাডি সময় ৫ থেকে ১২০ মিনিটের মধ্যে হতে হবে', 'error');
            return;
        }
        
        if (breakDuration < 5 || breakDuration > 60) {
            this.showNotification('ব্রেক সময় ৫ থেকে ৬০ মিনিটের মধ্যে হতে হবে', 'error');
            return;
        }
        
        this.state.studyTimer.studyTime = studyDuration * 60;
        this.state.studyTimer.breakTime = breakDuration * 60;
        this.state.settings.autoStartBreak = autoStartBreak;
        
        this.showNotification('টাইমার সেটিংস সেভ করা হয়েছে', 'success');
        this.saveState();
    }

    selectRingtone(ringtone) {
        this.state.settings.ringtone = ringtone;
        
        // Update active state
        document.querySelectorAll('.ringtone-select').forEach(select => {
            select.classList.remove('active');
            if (select.dataset.ringtone === ringtone) {
                select.classList.add('active');
            }
        });
        
        this.showNotification(`রিংটোন সিলেক্ট করা হয়েছে: ${ringtone}`, 'success');
        this.saveState();
    }

    previewRingtone(ringtone) {
        this.playAlarmSound(ringtone);
    }

    saveRingtoneSettings() {
        // Update settings from form
        this.state.settings.notifications = document.getElementById('notifications').checked;
        this.state.settings.soundEffects = document.getElementById('sound-effects').checked;
        this.state.settings.animations = document.getElementById('animations').checked;
        this.state.settings.autoBackup = document.getElementById('auto-backup').checked;
        
        this.showNotification('নোটিফিকেশন সেটিংস সেভ করা হয়েছে', 'success');
        this.saveState();
    }

    // Web Audio API based Ringtone System
    playAlarmSound(type = 'default') {
        if (!this.state.settings.soundEffects) return;
        
        // Create audio context if not exists
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        const audioContext = new AudioContext();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        // Different alarm types
        let frequency = 440; // A4
        let duration = 0.5;
        
        switch(type) {
            case 'alarm1':
                frequency = 523.25; // C5
                duration = 0.3;
                break;
            case 'alarm2':
                frequency = 659.25; // E5
                duration = 0.4;
                break;
            case 'alarm3':
                frequency = 784.00; // G5
                duration = 0.5;
                break;
            case 'success':
                frequency = 659.25; // E5 (rising tone)
                duration = 0.6;
                break;
            case 'error':
                frequency = 349.23; // F4 (falling tone)
                duration = 0.8;
                break;
            case 'warning':
                // Two-tone alarm
                this.playTwoToneAlarm();
                return;
        }
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
        
        // Volume control
        const volume = this.state.settings.volume / 100;
        gainNode.gain.setValueAtTime(0, audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(volume, audioContext.currentTime + 0.1);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + duration);
    }

    playTwoToneAlarm() {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        const audioContext = new AudioContext();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.type = 'sine';
        
        // First tone
        oscillator.frequency.setValueAtTime(523.25, audioContext.currentTime); // C5
        // Second tone after 0.2s
        oscillator.frequency.setValueAtTime(659.25, audioContext.currentTime + 0.2); // E5
        // Third tone after 0.4s
        oscillator.frequency.setValueAtTime(784.00, audioContext.currentTime + 0.4); // G5
        
        // Volume envelope
        const volume = this.state.settings.volume / 100;
        gainNode.gain.setValueAtTime(0, audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(volume, audioContext.currentTime + 0.1);
        gainNode.gain.setValueAtTime(volume, audioContext.currentTime + 0.5);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.8);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.8);
    }

    // Home Text Methods
    saveHomeText() {
        const homeText = document.getElementById('home-text').value;
        const footerText = document.getElementById('footer-text').value;
        const typingEffect = document.getElementById('typing-effect').checked;
        
        this.state.homeText = homeText;
        this.state.footerText = footerText;
        this.state.settings.typingEffect = typingEffect;
        
        // Update display
        this.updateHomeTextDisplay();
        
        this.showNotification('হোম পেইজ টেক্সট সেভ করা হয়েছে', 'success');
        this.saveState();
    }

    updateHomeTextDisplay() {
        const textElement = document.getElementById('home-warning-text');
        const footerElement = document.getElementById('footer-developed-by');
        
        if (textElement) {
            textElement.textContent = this.state.homeText;
        }
        
        if (footerElement) {
            footerElement.textContent = this.state.footerText;
        }
        
        // Restart typing effect if enabled
        if (this.state.settings.typingEffect) {
            this.startTypingEffect();
        }
    }

    startTypingEffect() {
        const textElement = document.getElementById('home-warning-text');
        if (!textElement) return;
        
        const text = this.state.homeText;
        if (!text) return;
        
        // Clear any existing animation
        if (this.typingInterval) {
            clearInterval(this.typingInterval);
        }
        
        textElement.classList.add('typing-text');
        textElement.textContent = '';
        
        let i = 0;
        this.typingInterval = setInterval(() => {
            if (i < text.length) {
                textElement.textContent += text.charAt(i);
                i++;
            } else {
                clearInterval(this.typingInterval);
                setTimeout(() => {
                    textElement.classList.remove('typing-text');
                    // Restart after 5 seconds
                    if (this.state.settings.typingEffect) {
                        setTimeout(() => this.startTypingEffect(), 5000);
                    }
                }, 2000);
            }
        }, 50);
    }

    // Profile Methods
    showProfileEditModal() {
        document.getElementById('edit-user-name').value = this.state.userName;
        document.getElementById('edit-avatar-color').value = this.state.avatarColor;
        document.getElementById('profile-edit-modal').style.display = 'flex';
    }

    saveProfileChanges() {
        const userName = document.getElementById('edit-user-name').value.trim();
        const avatarColor = document.getElementById('edit-avatar-color').value;
        
        if (!userName) {
            this.showNotification('দয়া করে আপনার নাম দিন', 'error');
            return;
        }
        
        this.state.userName = userName;
        this.state.avatarColor = avatarColor;
        
        this.updateUserProfile();
        this.saveState();
        
        document.getElementById('profile-edit-modal').style.display = 'none';
        this.showNotification('প্রোফাইল আপডেট করা হয়েছে', 'success');
    }

    saveProfile() {
        const userName = document.getElementById('user-name').value.trim();
        const avatarColor = document.getElementById('user-avatar-color').value;
        
        if (!userName) {
            this.showNotification('দয়া করে আপনার নাম দিন', 'error');
            return;
        }
        
        this.state.userName = userName;
        this.state.avatarColor = avatarColor;
        
        this.updateUserProfile();
        this.saveState();
        this.showNotification('প্রোফাইল সেভ করা হয়েছে', 'success');
    }

    // Topic Management
    addTopic() {
        const name = document.getElementById('topic-name').value.trim();
        const desc = document.getElementById('topic-desc').value.trim();
        const color = document.getElementById('topic-color').value;
        
        if (!name) {
            this.showNotification('দয়া করে টপিকের নাম দিন', 'error');
            return;
        }
        
        const topic = {
            id: Date.now(),
            name: name,
            description: desc,
            color: color,
            progress: 0,
            createdAt: new Date().toISOString(),
            lastStudied: null
        };
        
        this.state.topics.push(topic);
        this.renderTopics();
        
        // Clear form
        document.getElementById('topic-name').value = '';
        document.getElementById('topic-desc').value = '';
        
        this.showNotification('টপিক যোগ করা হয়েছে', 'success');
        this.saveState();
    }

    saveNewTopic() {
        const name = document.getElementById('new-topic-name').value.trim();
        const desc = document.getElementById('new-topic-description').value.trim();
        const color = document.getElementById('new-topic-color').value;
        const icon = document.querySelector('.icon-option.active')?.dataset.icon || 'book';
        
        if (!name) {
            this.showNotification('দয়া করে টপিকের নাম দিন', 'error');
            return;
        }
        
        const topic = {
            id: Date.now(),
            name: name,
            description: desc,
            color: color,
            icon: icon,
            progress: 0,
            createdAt: new Date().toISOString(),
            lastStudied: null
        };
        
        this.state.topics.push(topic);
        this.renderTopics();
        this.hideAddTopicModal();
        
        this.showNotification('টপিক যোগ করা হয়েছে', 'success');
        this.saveState();
    }

    clearTopics() {
        if (confirm('আপনি কি সব টপিক মুছে ফেলতে চান? এই কাজটি পূর্বাবস্থায় ফিরিয়ে আনা যাবে না।')) {
            this.state.topics = [];
            this.renderTopics();
            this.showNotification('সব টপিক মুছে ফেলা হয়েছে', 'warning');
            this.saveState();
        }
    }

    removeTopic(id) {
        if (confirm('আপনি কি এই টপিক মুছে ফেলতে চান?')) {
            this.state.topics = this.state.topics.filter(topic => topic.id !== id);
            this.renderTopics();
            this.showNotification('টপিক মুছে ফেলা হয়েছে', 'success');
            this.saveState();
        }
    }

    renderTopics() {
        const container = document.getElementById('topics-list-container');
        const existingList = document.getElementById('existing-topics-list');
        
        if (!container && !existingList) return;
        
        if (this.state.topics.length === 0) {
            if (container) {
                container.innerHTML = `
                    <div class="empty-topics">
                        <i class="fas fa-book-open"></i>
                        <p>কোনো টপিক যোগ করা হয়নি। সেটিংস থেকে টপিক যোগ করুন।</p>
                    </div>
                `;
            }
            
            if (existingList) {
                existingList.innerHTML = '<p class="gray-text">কোনো টপিক নেই</p>';
            }
            return;
        }
        
        // Render in home tab
        if (container) {
            let topicsHTML = '';
            this.state.topics.forEach(topic => {
                const iconClass = topic.icon ? `fas fa-${topic.icon}` : 'fas fa-book';
                
                topicsHTML += `
                    <div class="topic-card animate__animated animate__fadeIn">
                        <div class="topic-icon" style="background-color: ${topic.color}20; color: ${topic.color};">
                            <i class="${iconClass}"></i>
                        </div>
                        <div class="topic-info">
                            <h4>${topic.name}</h4>
                            <p>${topic.description || 'কোনো বর্ণনা নেই'}</p>
                            <div class="topic-progress">
                                <div class="progress-bar">
                                    <div class="progress-fill" style="width: ${topic.progress}%; background-color: ${topic.color};"></div>
                                </div>
                                <span>${topic.progress}%</span>
                            </div>
                        </div>
                        <div class="topic-actions">
                            <button class="topic-action-btn" onclick="app.selectTopic(${topic.id})" title="সিলেক্ট">
                                <i class="fas fa-check"></i>
                            </button>
                            <button class="topic-action-btn" onclick="app.editTopicProgress(${topic.id})" title="প্রগ্রেস এডিট">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="topic-action-btn" onclick="app.removeTopic(${topic.id})" title="মুছুন">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                `;
            });
            container.innerHTML = topicsHTML;
        }
        
        // Render in settings
        if (existingList) {
            let existingHTML = '';
            this.state.topics.forEach(topic => {
                existingHTML += `
                    <div class="existing-topic">
                        <span style="color: ${topic.color};">●</span>
                        <span style="flex: 1; margin: 0 10px; color: var(--text-color);">${topic.name}</span>
                        <span class="topic-progress-badge">${topic.progress}%</span>
                        <button onclick="app.removeTopic(${topic.id})" class="btn-small danger" style="margin-left: 10px;">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                `;
            });
            existingList.innerHTML = existingHTML;
        }
    }

    selectTopic(id) {
        const topic = this.state.topics.find(t => t.id === id);
        if (topic) {
            this.state.challengeTimer.topic = topic.name;
            this.updateChallengeDisplay();
            this.showNotification(`টপিক সিলেক্ট করা হয়েছে: ${topic.name}`, 'success');
            this.saveState();
        }
    }

    editTopicProgress(id) {
        const topic = this.state.topics.find(t => t.id === id);
        if (topic) {
            const newProgress = prompt(`"${topic.name}" টপিকের প্রগ্রেস এডিট করুন (0-100):`, topic.progress);
            if (newProgress !== null) {
                const progress = parseInt(newProgress);
                if (!isNaN(progress) && progress >= 0 && progress <= 100) {
                    topic.progress = progress;
                    topic.lastStudied = new Date().toISOString();
                    this.renderTopics();
                    this.showNotification('প্রগ্রেস আপডেট করা হয়েছে', 'success');
                    this.saveState();
                } else {
                    this.showNotification('দয়া করে ০ থেকে ১০০ এর মধ্যে একটি সংখ্যা দিন', 'error');
                }
            }
        }
    }

    showAddTopicModal() {
        document.getElementById('add-topic-modal').style.display = 'flex';
    }

    hideAddTopicModal() {
        document.getElementById('add-topic-modal').style.display = 'none';
    }

    // Daily Routine Methods
    changeMonth(delta) {
        // This would change the displayed month
        // For now, just update the display
        const now = new Date();
        now.setMonth(now.getMonth() + delta);
        const monthYear = now.toLocaleDateString('bn-BD', { year: 'numeric', month: 'long' });
        document.getElementById('current-month').textContent = monthYear;
        
        this.updateRoutineCalendar();
    }

    showAddRoutineModal() {
        document.getElementById('add-routine-modal').style.display = 'flex';
    }

    saveRoutineSettings() {
        const privateGoal = parseInt(document.getElementById('private-per-month').value);
        const collegeGoal = parseInt(document.getElementById('college-per-month').value);
        
        if (privateGoal < 0 || privateGoal > 31) {
            this.showNotification('প্রাইভেট দিন ০ থেকে ৩১ এর মধ্যে হতে হবে', 'error');
            return;
        }
        
        if (collegeGoal < 0 || collegeGoal > 31) {
            this.showNotification('কলেজ দিন ০ থেকে ৩১ এর মধ্যে হতে হবে', 'error');
            return;
        }
        
        this.state.dailyRoutine.monthlyGoalPrivate = privateGoal;
        this.state.dailyRoutine.monthlyGoalCollege = collegeGoal;
        
        this.updateRoutineStats();
        this.showNotification('রুটিন সেটিংস সেভ করা হয়েছে', 'success');
        this.saveState();
    }

    updateRoutineCalendar() {
        const container = document.getElementById('routine-calendar-days');
        if (!container) return;
        
        // For demo purposes, create a simple calendar
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth();
        
        // Get first day of month
        const firstDay = new Date(year, month, 1);
        // Get last day of month
        const lastDay = new Date(year, month + 1, 0);
        
        // Calculate days in month
        const daysInMonth = lastDay.getDate();
        
        // Calculate starting day (0 = Sunday, 1 = Monday, etc.)
        let startDay = firstDay.getDay();
        
        let calendarHTML = '';
        
        // Add empty cells for days before the first day of month
        for (let i = 0; i < startDay; i++) {
            calendarHTML += `<div class="calendar-day"></div>`;
        }
        
        // Add days of the month
        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(year, month, day);
            const isToday = date.toDateString() === new Date().toDateString();
            
            let dayClass = 'calendar-day';
            if (isToday) dayClass += ' today';
            
            // Check if this day has events
            const hasEvent = this.state.routines.some(routine => {
                const routineDate = new Date(routine.date);
                return routineDate.toDateString() === date.toDateString();
            });
            
            if (hasEvent) dayClass += ' event';
            
            calendarHTML += `
                <div class="${dayClass}" data-date="${date.toISOString().split('T')[0]}">
                    <div class="day-number">${day}</div>
                    <div class="day-events">
                        ${hasEvent ? '<div class="event-dot private"></div>' : ''}
                    </div>
                </div>
            `;
        }
        
        container.innerHTML = calendarHTML;
        
        // Add click events to days
        container.querySelectorAll('.calendar-day').forEach(day => {
            day.addEventListener('click', () => {
                const date = day.dataset.date;
                if (date) {
                    this.showRoutineForDate(date);
                }
            });
        });
    }

    updateRoutineStats() {
        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();
        
        const monthRoutines = this.state.routines.filter(routine => {
            const routineDate = new Date(routine.date);
            return routineDate.getMonth() === currentMonth && 
                   routineDate.getFullYear() === currentYear;
        });
        
        const privateDays = monthRoutines.filter(r => r.type === 'private' && r.attended).length;
        const collegeDays = monthRoutines.filter(r => r.type === 'college' && r.attended).length;
        const missedDays = monthRoutines.filter(r => !r.attended).length;
        
        document.getElementById('private-days').textContent = `${privateDays}/${this.state.dailyRoutine.monthlyGoalPrivate} দিন`;
        document.getElementById('college-days').textContent = `${collegeDays}/${this.state.dailyRoutine.monthlyGoalCollege} দিন`;
        document.getElementById('missed-days').textContent = `${missedDays} দিন`;
    }

    showRoutineForDate(date) {
        const routines = this.state.routines.filter(r => r.date === date);
        if (routines.length > 0) {
            let message = `${date} তারিখের রুটিন:\n\n`;
            routines.forEach(routine => {
                message += `${routine.type === 'private' ? 'প্রাইভেট' : 'কলেজ'}: ${routine.time}\n`;
                message += `এটেন্ড করেছে: ${routine.attended ? 'হ্যাঁ' : 'না'}\n\n`;
            });
            alert(message);
        } else {
            this.showNotification('এই তারিখে কোনো রুটিন নেই', 'info');
        }
    }

    // Calendar Methods
    changeCalendarMonth(delta) {
        // This would change the calendar month
        // For now, just update the display
        const now = new Date();
        now.setMonth(now.getMonth() + delta);
        const monthYear = now.toLocaleDateString('bn-BD', { year: 'numeric', month: 'long' });
        document.getElementById('calendar-month-year').textContent = monthYear;
        
        this.updateCalendarDates();
    }

    showAddEventModal() {
        document.getElementById('add-event-modal').style.display = 'flex';
    }

    saveEvent() {
        const title = document.getElementById('event-title').value.trim();
        const date = document.getElementById('event-date').value;
        const time = document.getElementById('event-time').value;
        const description = document.getElementById('event-description').value.trim();
        const alarm = document.getElementById('event-alarm').value;
        const color = document.querySelector('.color-option.active')?.dataset.color || '#6c63ff';
        
        if (!title) {
            this.showNotification('দয়া করে ইভেন্টের নাম দিন', 'error');
            return;
        }
        
        if (!date) {
            this.showNotification('দয়া তারিখ সিলেক্ট করুন', 'error');
            return;
        }
        
        const event = {
            id: Date.now(),
            title: title,
            date: date,
            time: time || null,
            description: description,
            alarm: alarm,
            color: color,
            createdAt: new Date().toISOString(),
            notified: false
        };
        
        this.state.events.push(event);
        this.updateCalendar();
        this.showNotification('ইভেন্ট সেভ করা হয়েছে', 'success');
        this.saveState();
        
        // Clear form
        document.getElementById('event-title').value = '';
        document.getElementById('event-date').value = '';
        document.getElementById('event-time').value = '';
        document.getElementById('event-description').value = '';
    }

    updateCalendar() {
        this.updateCalendarDates();
        this.updateEvents();
    }

    updateCalendarDates() {
        const container = document.getElementById('calendar-dates');
        if (!container) return;
        
        // Similar to routine calendar, create calendar dates
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth();
        
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const daysInMonth = lastDay.getDate();
        let startDay = firstDay.getDay();
        
        let calendarHTML = '';
        
        // Add empty cells
        for (let i = 0; i < startDay; i++) {
            calendarHTML += `<div class="calendar-date"></div>`;
        }
        
        // Add days
        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(year, month, day);
            const dateStr = date.toISOString().split('T')[0];
            const isToday = date.toDateString() === new Date().toDateString();
            
            let dateClass = 'calendar-date';
            if (isToday) dateClass += ' today';
            
            // Check for events
            const hasEvent = this.state.events.some(event => event.date === dateStr);
            if (hasEvent) dateClass += ' has-event';
            
            calendarHTML += `
                <div class="${dateClass}" data-date="${dateStr}">
                    <div class="date-number">${day}</div>
                </div>
            `;
        }
        
        container.innerHTML = calendarHTML;
        
        // Add click events
        container.querySelectorAll('.calendar-date').forEach(dateEl => {
            dateEl.addEventListener('click', () => {
                const date = dateEl.dataset.date;
                if (date) {
                    this.showEventsForDate(date);
                }
            });
        });
    }

    updateEvents() {
        const today = new Date().toISOString().split('T')[0];
        const todayEvents = this.state.events.filter(event => event.date === today);
        const upcomingEvents = this.getUpcomingEvents(5);
        
        this.renderEventList('today-events', todayEvents);
        this.renderUpcomingEvents('upcoming-events', upcomingEvents);
    }

    getUpcomingEvents(limit = 5) {
        const now = new Date();
        return this.state.events
            .filter(event => new Date(event.date) >= now)
            .sort((a, b) => new Date(a.date) - new Date(b.date))
            .slice(0, limit);
    }

    renderEventList(containerId, events) {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        if (events.length === 0) {
            container.innerHTML = `
                <div class="empty-events">
                    <i class="fas fa-calendar-times"></i>
                    <p>কোনো ইভেন্ট নেই</p>
                </div>
            `;
            return;
        }
        
        let eventsHTML = '';
        events.forEach(event => {
            eventsHTML += `
                <div class="event-item">
                    <div class="event-color" style="background-color: ${event.color};"></div>
                    <div class="event-details">
                        <h4>${event.title}</h4>
                        <p>${event.description || 'কোনো বর্ণনা নেই'}</p>
                        <div class="event-time">${event.time || 'সারা দিন'}</div>
                    </div>
                </div>
            `;
        });
        
        container.innerHTML = eventsHTML;
    }

    renderUpcomingEvents(containerId, events) {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        if (events.length === 0) {
            container.innerHTML = `
                <div class="empty-upcoming">
                    <p>কোনো আসন্ন ইভেন্ট নেই</p>
                </div>
            `;
            return;
        }
        
        let eventsHTML = '';
        events.forEach(event => {
            const date = new Date(event.date);
            const dateStr = date.toLocaleDateString('bn-BD', { day: 'numeric', month: 'short' });
            
            eventsHTML += `
                <div class="upcoming-item">
                    <div class="event-details">
                        <h4>${event.title}</h4>
                        <div class="event-time">${dateStr}</div>
                    </div>
                </div>
            `;
        });
        
        container.innerHTML = eventsHTML;
    }

    showEventsForDate(date) {
        const events = this.state.events.filter(event => event.date === date);
        if (events.length > 0) {
            let message = `${date} তারিখের ইভেন্ট:\n\n`;
            events.forEach(event => {
                message += `${event.title}\n`;
                if (event.time) message += `সময়: ${event.time}\n`;
                if (event.description) message += `বর্ণনা: ${event.description}\n`;
                message += `\n`;
            });
            alert(message);
        } else {
            this.showNotification('এই তারিখে কোনো ইভেন্ট নেই', 'info');
        }
    }

    // History Methods
    filterHistory(filter) {
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.filter === filter) {
                btn.classList.add('active');
            }
        });
        
        if (filter === 'custom') {
            document.getElementById('custom-date-range').style.display = 'flex';
        } else {
            document.getElementById('custom-date-range').style.display = 'none';
            this.updateHistoryTable(filter);
        }
    }

    applyDateRange() {
        const startDate = document.getElementById('start-date').value;
        const endDate = document.getElementById('end-date').value;
        
        if (!startDate || !endDate) {
            this.showNotification('দয়া করে শুরু এবং শেষ তারিখ দিন', 'error');
            return;
        }
        
        this.updateHistoryTable('custom', { startDate, endDate });
    }

    updateHistoryTable(filter = 'all', options = {}) {
        const container = document.getElementById('history-table-body');
        if (!container) return;
        
        let filteredHistory = [...this.state.studyHistory];
        
        // Apply filter
        const now = new Date();
        switch(filter) {
            case 'today':
                const today = now.toISOString().split('T')[0];
                filteredHistory = filteredHistory.filter(record => 
                    record.date.startsWith(today)
                );
                break;
            case 'week':
                const weekAgo = new Date(now.setDate(now.getDate() - 7));
                filteredHistory = filteredHistory.filter(record => 
                    new Date(record.date) >= weekAgo
                );
                break;
            case 'month':
                const monthAgo = new Date(now.setMonth(now.getMonth() - 1));
                filteredHistory = filteredHistory.filter(record => 
                    new Date(record.date) >= monthAgo
                );
                break;
            case 'custom':
                if (options.startDate && options.endDate) {
                    filteredHistory = filteredHistory.filter(record => {
                        const recordDate = new Date(record.date);
                        return recordDate >= new Date(options.startDate) && 
                               recordDate <= new Date(options.endDate);
                    });
                }
                break;
        }
        
        if (filteredHistory.length === 0) {
            container.innerHTML = `
                <tr>
                    <td colspan="5" class="no-data">কোনো ডাটা পাওয়া যায়নি</td>
                </tr>
            `;
            return;
        }
        
        let tableHTML = '';
        filteredHistory.forEach(record => {
            const date = new Date(record.date);
            const dateStr = date.toLocaleDateString('bn-BD', { 
                day: 'numeric', 
                month: 'short', 
                year: 'numeric' 
            });
            
            const hours = Math.floor(record.duration / 3600);
            const minutes = Math.floor((record.duration % 3600) / 60);
            const timeStr = `${hours > 0 ? hours + 'ঘ ' : ''}${minutes}ম`;
            
            tableHTML += `
                <tr>
                    <td>${dateStr}</td>
                    <td>${record.topic || 'সাধারণ'}</td>
                    <td>${timeStr}</td>
                    <td>${record.session || '-'}</td>
                    <td><span class="status ${record.status || 'completed'}">${record.status === 'completed' ? 'সম্পূর্ণ' : 'অসম্পূর্ণ'}</span></td>
                </tr>
            `;
        });
        
        container.innerHTML = tableHTML;
    }

    // Chart Methods
    initializeCharts() {
        this.historyChart = this.createHistoryChart();
        this.routineChart = this.createRoutineChart();
        // Screen Time chart removed as requested
    }

    createHistoryChart() {
        const ctx = document.getElementById('historyChart');
        if (!ctx) return null;
        
        return new Chart(ctx.getContext('2d'), {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'পড়াশোনার সময়',
                    data: [],
                    borderColor: 'var(--primary-color)',
                    backgroundColor: 'rgba(108, 99, 255, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return value + 'ঘ';
                            }
                        }
                    }
                }
            }
        });
    }

    updateHistoryChart() {
        if (!this.historyChart) return;
        
        const weeklyData = this.getWeeklyStudyData();
        this.historyChart.data.labels = weeklyData.labels;
        this.historyChart.data.datasets[0].data = weeklyData.data;
        this.historyChart.update();
    }

    getWeeklyStudyData() {
        const labels = [];
        const data = [];
        
        for (let i = 6; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];
            
            const dayStudy = this.state.studyHistory
                .filter(record => record.date.startsWith(dateStr))
                .reduce((total, record) => total + record.duration, 0);
            
            labels.push(date.toLocaleDateString('bn-BD', { weekday: 'short' }));
            data.push(Math.round(dayStudy / 3600 * 10) / 10);
        }
        
        return { labels, data };
    }

    createRoutineChart() {
        const ctx = document.getElementById('routineChart');
        if (!ctx) return null;
        
        return new Chart(ctx.getContext('2d'), {
            type: 'doughnut',
            data: {
                labels: ['প্রাইভেট', 'কলেজ', 'মিসড'],
                datasets: [{
                    data: [0, 0, 0],
                    backgroundColor: [
                        'rgba(76, 175, 80, 0.7)',
                        'rgba(33, 150, 243, 0.7)',
                        'rgba(255, 101, 132, 0.7)'
                    ],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });
    }

    updateRoutineChart() {
        if (!this.routineChart) return;
        
        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();
        
        const monthRoutines = this.state.routines.filter(routine => {
            const routineDate = new Date(routine.date);
            return routineDate.getMonth() === currentMonth && 
                   routineDate.getFullYear() === currentYear;
        });
        
        const privateDays = monthRoutines.filter(r => r.type === 'private' && r.attended).length;
        const collegeDays = monthRoutines.filter(r => r.type === 'college' && r.attended).length;
        const missedDays = monthRoutines.filter(r => !r.attended).length;
        
        this.routineChart.data.datasets[0].data = [privateDays, collegeDays, missedDays];
        this.routineChart.update();
    }

    // Data Management
    exportData() {
        const data = {
            ...this.state,
            exportDate: new Date().toISOString(),
            version: '3.0.0'
        };
        
        const dataStr = JSON.stringify(data, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
        
        const exportFileDefaultName = `study-tracker-backup-${new Date().toISOString().split('T')[0]}.json`;
        
        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click();
        
        this.showNotification('ডেটা এক্সপোর্ট করা হয়েছে', 'success');
    }

    importData() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const importedData = JSON.parse(event.target.result);
                    
                    // Validate imported data
                    if (!importedData.topics || !importedData.events) {
                        throw new Error('Invalid data format');
                    }
                    
                    // Merge with current state
                    this.state = {
                        ...this.state,
                        ...importedData,
                        // Keep some settings
                        settings: {
                            ...this.state.settings,
                            ...importedData.settings
                        }
                    };
                    
                    this.saveState();
                    this.initializeUI();
                    this.showNotification('ডেটা ইম্পোর্ট করা হয়েছে', 'success');
                } catch (error) {
                    console.error('Import error:', error);
                    this.showNotification('ডেটা ইম্পোর্ট করতে সমস্যা হয়েছে', 'error');
                }
            };
            reader.readAsText(file);
        };
        
        input.click();
    }

    clearData() {
        if (confirm('আপনি কি সব ডেটা মুছে ফেলতে চান? এই কাজটি পূর্বাবস্থায় ফিরিয়ে আনা যাবে না।')) {
            localStorage.clear();
            this.state = new StudyTrackerApp().state;
            this.initializeUI();
            this.showNotification('সব ডেটা মুছে ফেলা হয়েছে', 'warning');
        }
    }

    checkUpdates() {
        this.showNotification('আপনি সর্বশেষ ভার্সন ব্যবহার করছেন', 'info');
    }

    reportBug() {
        const bug = prompt('দয়া করে বাগ বা সমস্যার বর্ণনা দিন:');
        if (bug) {
            this.showNotification('বাগ রিপোর্ট করা হয়েছে, ধন্যবাদ!', 'success');
            // In a real app, this would send to a server
            console.log('Bug report:', bug);
        }
    }

    shareApp() {
        if (navigator.share) {
            navigator.share({
                title: 'Smart Study Tracker',
                text: 'একটি প্রিমিয়াম স্টাডি ট্র্যাকার অ্যাপ',
                url: window.location.href
            });
        } else {
            // Fallback
            navigator.clipboard.writeText(window.location.href);
            this.showNotification('লিঙ্ক কপি করা হয়েছে', 'success');
        }
    }

    // Utility Methods
    showNotification(message, type = 'info') {
        if (!this.state.settings.notifications) return;
        
        // Create notification object
        const notification = {
            id: Date.now(),
            message: message,
            type: type,
            time: new Date().toISOString(),
            read: false
        };
        
        this.state.notifications.unshift(notification);
        this.updateNotificationBadge();
        
        // Show toast
        this.showToast(message, type);
        
        // Play sound based on notification type
        if (this.state.settings.soundEffects) {
            this.playAlarmSound(type);
        }
    }

    showToast(message, type) {
        // Remove existing toasts
        document.querySelectorAll('.toast').forEach(toast => toast.remove());
        
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <div class="toast-content">
                <i class="fas fa-${this.getToastIcon(type)}"></i>
                <span>${message}</span>
            </div>
            <button class="toast-close">&times;</button>
        `;
        
        document.body.appendChild(toast);
        
        // Animate in
        setTimeout(() => toast.classList.add('show'), 100);
        
        // Auto remove
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
        
        // Close button
        toast.querySelector('.toast-close').addEventListener('click', () => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        });
    }

    getToastIcon(type) {
        switch(type) {
            case 'success': return 'check-circle';
            case 'error': return 'exclamation-circle';
            case 'warning': return 'exclamation-triangle';
            default: return 'info-circle';
        }
    }

    updateNotificationBadge() {
        const unread = this.state.notifications.filter(n => !n.read).length;
        const badge = document.getElementById('notification-count');
        if (badge) {
            badge.textContent = unread > 99 ? '99+' : unread.toString();
            badge.style.display = unread > 0 ? 'flex' : 'none';
        }
    }

    addToStudyHistory(record) {
        this.state.studyHistory.push(record);
        this.updateStats();
        this.saveState();
    }

    getTodayStudyTime() {
        const today = new Date().toISOString().split('T')[0];
        return this.state.studyHistory
            .filter(record => record.date.startsWith(today))
            .reduce((total, record) => total + record.duration, 0);
    }

    updateStats() {
        const todayStudied = this.getTodayStudyTime();
        const todayHours = Math.floor(todayStudied / 3600);
        const todayMins = Math.floor((todayStudied % 3600) / 60);
        
        const todayStudyElement = document.getElementById('today-study-time');
        if (todayStudyElement) {
            todayStudyElement.textContent = `${todayHours}h ${todayMins}m`;
        }
        
        // Calculate weekly total
        const weekTotal = this.getWeeklyTotal();
        const weekHours = Math.floor(weekTotal / 3600);
        const weekMins = Math.floor((weekTotal % 3600) / 60);
        
        const weekStudyElement = document.getElementById('week-study-time');
        if (weekStudyElement) {
            weekStudyElement.textContent = `${weekHours}h ${weekMins}m`;
        }
        
        // Update challenge streak
        this.updateChallengeStreak();
    }

    getWeeklyTotal() {
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        
        return this.state.studyHistory
            .filter(record => new Date(record.date) >= oneWeekAgo)
            .reduce((total, record) => total + record.duration, 0);
    }

    updateChallengeStreak() {
        // For demo, calculate a simple streak
        let streak = 0;
        const today = new Date();
        
        for (let i = 0; i < 30; i++) {
            const date = new Date(today);
            date.setDate(today.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];
            
            const hasStudy = this.state.studyHistory.some(record => 
                record.date.startsWith(dateStr) && record.duration > 0
            );
            
            if (hasStudy) {
                streak++;
            } else {
                break;
            }
        }
        
        const streakElement = document.getElementById('challenge-streak');
        if (streakElement) {
            streakElement.textContent = `${streak} দিন`;
        }
        
        // Update completed topics
        const completed = this.state.topics.filter(t => t.progress === 100).length;
        const completedElement = document.getElementById('completed-topics');
        if (completedElement) {
            completedElement.textContent = completed;
        }
        
        // Update success rate
        const totalTopics = this.state.topics.length;
        const successRate = totalTopics > 0 ? Math.round((completed / totalTopics) * 100) : 0;
        const successRateElement = document.getElementById('success-rate');
        if (successRateElement) {
            successRateElement.textContent = `${successRate}%`;
        }
    }

    updateAllDisplays() {
        this.updateClock();
        this.updateChallengeDisplay();
        this.updateStudyTimerDisplay();
        this.updateSessionsDisplay();
        this.updateStats();
        this.updateRoutineStats();
        this.updateRoutineChart();
        this.updateHistoryChart();
        this.updateDeviceInfo();
        this.updateHomeTextDisplay();
        this.updateUserProfile();
    }

    updateAllTimers() {
        this.updateAllDisplays();
    }

    syncData() {
        if (navigator.onLine) {
            this.showNotification('ডেটা সিঙ্ক করা হচ্ছে...', 'info');
            // In a real app, this would sync with server
            setTimeout(() => {
                this.showNotification('ডেটা সিঙ্ক সম্পূর্ণ', 'success');
            }, 1000);
        }
    }
}

// Initialize the app when DOM is loaded
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new StudyTrackerApp();
    window.app = app; // Make app accessible globally
    
    // Ensure only active tab is visible on page load
    document.querySelectorAll('.tab-pane').forEach(tab => {
        if (!tab.classList.contains('active')) {
            tab.style.display = 'none';
        } else {
            tab.style.display = 'block';
        }
    });
});

// Add CSS for animations
const animationStyles = document.createElement('style');
animationStyles.textContent = `
@keyframes slideIn {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
}

@keyframes slideOut {
    from { transform: translateX(0); opacity: 1; }
    to { transform: translateX(100%); opacity: 0; }
}

.animate__animated {
    animation-duration: 0.5s;
}

/* Loading animation */
.loading {
    display: inline-block;
    width: 20px;
    height: 20px;
    border: 3px solid rgba(108, 99, 255, 0.3);
    border-radius: 50%;
    border-top-color: var(--primary-color);
    animation: spin 1s ease-in-out infinite;
}

@keyframes spin {
    to { transform: rotate(360deg); }
}

/* Pulse animation for active timers */
.timer-pulse {
    animation: pulse 2s infinite;
}

@keyframes pulse {
    0% { box-shadow: 0 0 0 0 rgba(108, 99, 255, 0.4); }
    70% { box-shadow: 0 0 0 10px rgba(108, 99, 255, 0); }
    100% { box-shadow: 0 0 0 0 rgba(108, 99, 255, 0); }
}

/* Mobile Tab Animation */
@media (max-width: 767px) {
    .tab-pane.active {
        animation: mobileTabFadeIn 0.4s ease;
    }
    
    @keyframes mobileTabFadeIn {
        from {
            opacity: 0;
        }
        to {
            opacity: 1;
        }
    }
}

/* Typing Effect */
.typing-container {
    position: relative;
}

.typing-text {
    overflow: hidden;
    border-right: 3px solid var(--primary-color);
    white-space: nowrap;
    animation: typing 3.5s steps(40, end), blink-caret 0.75s step-end infinite;
}

@keyframes typing {
    from { width: 0 }
    to { width: 100% }
}

@keyframes blink-caret {
    from, to { border-color: transparent }
    50% { border-color: var(--primary-color); }
}

/* Time Update Animation */
.time-update-animation {
    animation: timeUpdate 0.5s ease;
}

@keyframes timeUpdate {
    0% { opacity: 0.5; transform: scale(0.95); }
    100% { opacity: 1; transform: scale(1); }
}
`;
document.head.appendChild(animationStyles);