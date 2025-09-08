class HealthTracker {
    constructor() {
        this.currentDate = new Date().toISOString().split('T')[0];
        this.exercises = [
            { id: 'squat', name: '스쿼트', count: 0 },
            { id: 'bicep-curl', name: '이두근 운동', count: 0 },
            { id: 'tricep-extension', name: '삼두근 운동', count: 0 },
            { id: 'inverted-row', name: '인버티드 로우', count: 0 },
            { id: 'pushup', name: '푸쉬업', count: 0 },
            { id: 'deadlift', name: '데드리프트', count: 0 }
        ];
        this.currentExercise = null;
        this.deferredPrompt = null;
        
        this.init();
    }

    init() {
        this.registerServiceWorker();
        this.setupPWAInstall();
        this.setupEventListeners();
        this.loadData();
        this.updateDateDisplay();
        this.checkDateChange();
        this.renderExercises();
        this.loadMealLog();
    }

    async registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            try {
                await navigator.serviceWorker.register('./sw.js');
                console.log('Service Worker 등록 성공');
            } catch (error) {
                console.log('Service Worker 등록 실패:', error);
            }
        }
    }

    setupPWAInstall() {
        // iOS Safari 감지
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
        
        if (isIOS && !isStandalone) {
            this.showIOSInstallMessage();
        }

        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            this.deferredPrompt = e;
            console.log('beforeinstallprompt 이벤트 발생');
            this.showInstallButton();
        });

        window.addEventListener('appinstalled', () => {
            console.log('PWA가 설치되었습니다.');
            this.hideInstallButton();
            this.deferredPrompt = null;
        });

        // 디버깅을 위한 로그
        setTimeout(() => {
            if (!this.deferredPrompt) {
                console.log('beforeinstallprompt 이벤트가 발생하지 않았습니다.');
                console.log('현재 환경:', {
                    userAgent: navigator.userAgent,
                    protocol: window.location.protocol,
                    isSecureContext: window.isSecureContext
                });
            }
        }, 3000);
    }

    showInstallButton() {
        let installBtn = document.getElementById('installBtn');
        if (!installBtn) {
            installBtn = document.createElement('button');
            installBtn.id = 'installBtn';
            installBtn.className = 'install-btn';
            installBtn.innerHTML = '📱 앱 설치';
            installBtn.addEventListener('click', () => this.installPWA());
            
            const header = document.querySelector('.app-header');
            header.appendChild(installBtn);
        }
        installBtn.style.display = 'block';
    }

    hideInstallButton() {
        const installBtn = document.getElementById('installBtn');
        if (installBtn) {
            installBtn.style.display = 'none';
        }
    }

    async installPWA() {
        if (!this.deferredPrompt) return;
        
        this.deferredPrompt.prompt();
        const { outcome } = await this.deferredPrompt.userChoice;
        
        if (outcome === 'accepted') {
            console.log('사용자가 PWA 설치를 승인했습니다.');
        } else {
            console.log('사용자가 PWA 설치를 거부했습니다.');
        }
        
        this.deferredPrompt = null;
        this.hideInstallButton();
    }

    showIOSInstallMessage() {
        const message = document.createElement('div');
        message.className = 'ios-install-message';
        message.innerHTML = `
            <div class="ios-install-content">
                <p>📱 홈 화면에 추가하세요!</p>
                <p>Safari 하단의 <strong>공유</strong> 버튼 → <strong>홈 화면에 추가</strong></p>
                <button onclick="this.parentElement.parentElement.remove()">닫기</button>
            </div>
        `;
        document.body.appendChild(message);
        
        setTimeout(() => {
            if (message.parentElement) {
                message.remove();
            }
        }, 10000);
    }

    setupEventListeners() {
        document.getElementById('resetAllBtn').addEventListener('click', () => this.resetAllExercises());

        // 모달 관련
        document.getElementById('closeModal').addEventListener('click', () => this.closeModal());
        document.getElementById('resetCount').addEventListener('click', () => this.resetCount());

        // 카운터 버튼
        document.querySelectorAll('.count-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const increment = parseInt(e.target.dataset.increment);
                this.incrementCount(increment);
            });
        });

        // 모달 외부 클릭 시 닫기
        document.getElementById('exerciseModal').addEventListener('click', (e) => {
            if (e.target.id === 'exerciseModal') {
                this.closeModal();
            }
        });

        // 날짜 변경 감지 (매분 체크)
        setInterval(() => this.checkDateChange(), 60000);

        // 식사 기록
        document.querySelectorAll('.meal-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.handleMealButtonClick(e));
        });
        document.getElementById('mealLogBox').addEventListener('input', () => this.saveMealLog());
    }

    updateDateDisplay() {
        const today = new Date();
        const options = { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric',
            weekday: 'long'
        };
        document.getElementById('currentDate').textContent = today.toLocaleDateString('ko-KR', options);
    }

    checkDateChange() {
        const newDate = new Date().toISOString().split('T')[0];
        if (newDate !== this.currentDate) {
            this.saveCurrentDayData();
            this.currentDate = newDate;
            this.resetDailyData();
            this.updateDateDisplay();
            this.renderExercises();
            this.loadMealLog();
        }
    }

    saveCurrentDayData() {
        const dayData = {
            date: this.currentDate,
            exercises: this.exercises.map(ex => ({ ...ex })),
        };
        
        const history = JSON.parse(localStorage.getItem('healthTrackerHistory') || '[]');
        const existingIndex = history.findIndex(item => item.date === this.currentDate);
        
        if (existingIndex >= 0) {
            history[existingIndex] = dayData;
        } else {
            history.push(dayData);
        }
        
        localStorage.setItem('healthTrackerHistory', JSON.stringify(history));
    }

    resetDailyData() {
        this.exercises.forEach(exercise => exercise.count = 0);
        document.getElementById('mealLogBox').value = '';
        this.saveData();
        this.saveMealLog();
    }

    renderExercises() {
        console.log('Rendering exercises:', this.exercises);
        const exerciseList = document.getElementById('exerciseList');
        exerciseList.innerHTML = '';

        this.exercises.forEach(exercise => {
            const exerciseCard = document.createElement('div');
            exerciseCard.className = 'exercise-card';
            exerciseCard.innerHTML = `
                <div class="exercise-name">${exercise.name}</div>
                <div class="exercise-count">${exercise.count}회</div>
            `;
            exerciseCard.addEventListener('click', () => this.openExerciseModal(exercise));
            exerciseList.appendChild(exerciseCard);
        });
    }


    openExerciseModal(exercise) {
        this.currentExercise = exercise;
        document.getElementById('exerciseTitle').textContent = exercise.name;
        document.getElementById('currentCount').textContent = exercise.count;
        
        document.getElementById('exerciseModal').style.display = 'block';
    }

    closeModal() {
        document.getElementById('exerciseModal').style.display = 'none';
        this.currentExercise = null;
    }

    incrementCount(increment) {
        if (this.currentExercise) {
            this.currentExercise.count += increment;
            document.getElementById('currentCount').textContent = this.currentExercise.count;
            this.renderExercises();
            this.saveData();
        }
    }

    resetCount() {
        if (this.currentExercise) {
            this.currentExercise.count = 0;
            document.getElementById('currentCount').textContent = 0;
            this.renderExercises();
            this.saveData();
        }
    }

    resetAllExercises() {
        if (confirm('모든 운동 기록을 초기화하시겠습니까?')) {
            this.exercises.forEach(exercise => exercise.count = 0);
            this.renderExercises();
            this.saveData();
        }
    }

    saveData() {
        const data = {
            exercises: this.exercises
        };
        localStorage.setItem(`healthTracker_${this.currentDate}`, JSON.stringify(data));
    }

    loadData() {
        const data = JSON.parse(localStorage.getItem(`healthTracker_${this.currentDate}`) || '{}');
        
        if (data.exercises) {
            this.exercises = data.exercises;
        }
    }

    handleMealButtonClick(e) {
        const mealType = e.target.dataset.meal;
        if (mealType === '현재시간') {
            this.addCurrentTimeToMealLog();
        } else {
            this.addTextToMealLog(mealType, true);
        }
    }

    addCurrentTimeToMealLog() {
        const now = new Date();
        const timeString = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        const textarea = document.getElementById('mealLogBox');
        const isFirstEntry = textarea.value.trim() === '';
        this.addTextToMealLog(isFirstEntry ? `${timeString} ` : `
${timeString} `, false);
    }

    addTextToMealLog(text, addSpace = false) {
        const textarea = document.getElementById('mealLogBox');
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        let newText = text;
        if (addSpace) {
            const before = textarea.value.substring(0, start);
            if (before.length > 0 && !/\s$/.test(before)) {
                newText = ' ' + newText;
            }
        }
        textarea.value = textarea.value.substring(0, start) + newText + textarea.value.substring(end);
        textarea.selectionStart = textarea.selectionEnd = start + newText.length;
        textarea.focus();
        this.saveMealLog();
    }

    saveMealLog() {
        const mealLog = document.getElementById('mealLogBox').value;
        localStorage.setItem(`mealLog_${this.currentDate}`, mealLog);
    }

    loadMealLog() {
        const mealLog = localStorage.getItem(`mealLog_${this.currentDate}`) || '';
        document.getElementById('mealLogBox').value = mealLog;
    }
}

// 앱 초기화
document.addEventListener('DOMContentLoaded', () => {
    new HealthTracker();
});
