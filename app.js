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
        this.bookmarks = [];
        this.currentExercise = null;
        this.medicineCount = 0;
        this.medicineMaxCount = 2;
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
        this.renderBookmarks();
        this.loadMealDiary();
        this.loadHealthData();
        this.updateFastingTime();
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
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            this.deferredPrompt = e;
            this.showInstallButton();
        });

        window.addEventListener('appinstalled', () => {
            console.log('PWA가 설치되었습니다.');
            this.hideInstallButton();
            this.deferredPrompt = null;
        });
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

    setupEventListeners() {
        // 탭 전환
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
        });

        // 모달 관련
        document.getElementById('closeModal').addEventListener('click', () => this.closeModal());
        document.getElementById('resetCount').addEventListener('click', () => this.resetCount());
        document.getElementById('bookmarkToggle').addEventListener('click', () => this.toggleBookmark());

        // 카운터 버튼
        document.querySelectorAll('.count-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const increment = parseInt(e.target.dataset.increment);
                this.incrementCount(increment);
            });
        });

        // 식사 일기
        document.getElementById('mealDiary').addEventListener('keydown', (e) => this.handleMealDiaryInput(e));
        document.getElementById('addMealTime').addEventListener('click', () => this.addMealTime());
        document.getElementById('saveMeal').addEventListener('click', () => this.saveMealDiary());

        // 건강 체크 버튼
        document.getElementById('wakeUpBtn').addEventListener('click', () => this.recordWakeUp());
        document.getElementById('sleepBtn').addEventListener('click', () => this.recordSleep());
        document.getElementById('morningMedicineBtn').addEventListener('click', () => this.recordMedicine('morning'));
        document.getElementById('eveningMedicineBtn').addEventListener('click', () => this.recordMedicine('evening'));

        // 모달 외부 클릭 시 닫기
        document.getElementById('exerciseModal').addEventListener('click', (e) => {
            if (e.target.id === 'exerciseModal') {
                this.closeModal();
            }
        });

        // 날짜 변경 감지 (매분 체크)
        setInterval(() => this.checkDateChange(), 60000);
    }

    switchTab(tabName) {
        // 탭 버튼 활성화 상태 변경
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

        // 탭 콘텐츠 표시 변경
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        document.getElementById(`${tabName}-tab`).classList.add('active');

        // 히스토리 탭일 때 통계 업데이트
        if (tabName === 'history') {
            this.updateStats();
        }
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
            this.loadMealDiary();
            this.loadHealthData();
        }
    }

    saveCurrentDayData() {
        const dayData = {
            date: this.currentDate,
            exercises: this.exercises.map(ex => ({ ...ex })),
            mealDiary: document.getElementById('mealDiary').value,
            health: {
                wakeUpTime: document.getElementById('wakeUpTime').textContent,
                sleepTime: document.getElementById('sleepTime').textContent,
                morningMedicineTime: document.getElementById('morningMedicineTime').textContent,
                eveningMedicineTime: document.getElementById('eveningMedicineTime').textContent
            }
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
        document.getElementById('mealDiary').value = '';
        document.getElementById('wakeUpTime').textContent = '미기록';
        document.getElementById('sleepTime').textContent = '미기록';
        document.getElementById('morningMedicineTime').textContent = '미복용';
        document.getElementById('eveningMedicineTime').textContent = '미복용';
        this.saveData();
    }

    renderExercises() {
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

    renderBookmarks() {
        const bookmarkContainer = document.getElementById('bookmarkExercises');
        bookmarkContainer.innerHTML = '';

        if (this.bookmarks.length === 0) {
            bookmarkContainer.innerHTML = '<p style="text-align: center; color: #666; padding: 2rem;">북마크된 운동이 없습니다.</p>';
            return;
        }

        this.bookmarks.forEach(bookmarkId => {
            const exercise = this.exercises.find(ex => ex.id === bookmarkId);
            if (exercise) {
                const bookmarkCard = document.createElement('div');
                bookmarkCard.className = 'bookmark-card';
                bookmarkCard.innerHTML = `
                    <div class="exercise-name">${exercise.name}</div>
                    <div class="exercise-count">${exercise.count}회</div>
                `;
                bookmarkCard.addEventListener('click', () => this.openExerciseModal(exercise));
                bookmarkContainer.appendChild(bookmarkCard);
            }
        });
    }

    openExerciseModal(exercise) {
        this.currentExercise = exercise;
        document.getElementById('exerciseTitle').textContent = exercise.name;
        document.getElementById('currentCount').textContent = exercise.count;
        
        const bookmarkBtn = document.getElementById('bookmarkToggle');
        const isBookmarked = this.bookmarks.includes(exercise.id);
        bookmarkBtn.textContent = isBookmarked ? '★' : '☆';
        bookmarkBtn.classList.toggle('active', isBookmarked);
        
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
            this.renderBookmarks();
            this.saveData();
        }
    }

    resetCount() {
        if (this.currentExercise) {
            this.currentExercise.count = 0;
            document.getElementById('currentCount').textContent = 0;
            this.renderExercises();
            this.renderBookmarks();
            this.saveData();
        }
    }

    toggleBookmark() {
        if (!this.currentExercise) return;

        const exerciseId = this.currentExercise.id;
        const isBookmarked = this.bookmarks.includes(exerciseId);

        if (isBookmarked) {
            this.bookmarks = this.bookmarks.filter(id => id !== exerciseId);
        } else {
            if (this.bookmarks.length < 5) {
                this.bookmarks.push(exerciseId);
            } else {
                alert('최대 5개까지만 북마크할 수 있습니다.');
                return;
            }
        }

        const bookmarkBtn = document.getElementById('bookmarkToggle');
        bookmarkBtn.textContent = this.bookmarks.includes(exerciseId) ? '★' : '☆';
        bookmarkBtn.classList.toggle('active', this.bookmarks.includes(exerciseId));

        this.renderBookmarks();
        this.saveData();
    }

    handleMealDiaryInput(e) {
        if (e.key === 'Enter') {
            const textarea = e.target;
            const cursorPosition = textarea.selectionStart;
            const textBeforeCursor = textarea.value.substring(0, cursorPosition);
            
            if (textBeforeCursor.endsWith('\n') || textBeforeCursor === '') {
                e.preventDefault();
                this.addMealTime();
            }
        }
    }

    addMealTime() {
        const textarea = document.getElementById('mealDiary');
        const now = new Date();
        const timeString = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')} `;
        
        const cursorPosition = textarea.selectionStart;
        const textBefore = textarea.value.substring(0, cursorPosition);
        const textAfter = textarea.value.substring(cursorPosition);
        
        // 새 줄이 필요한 경우 추가
        const needNewLine = textBefore !== '' && !textBefore.endsWith('\n');
        const newText = textBefore + (needNewLine ? '\n' : '') + timeString + textAfter;
        
        textarea.value = newText;
        textarea.selectionStart = textarea.selectionEnd = cursorPosition + (needNewLine ? 1 : 0) + timeString.length;
        textarea.focus();
    }

    saveMealDiary() {
        const mealText = document.getElementById('mealDiary').value;
        localStorage.setItem(`mealDiary_${this.currentDate}`, mealText);
        this.updateFastingTime();
        alert('식사 일기가 저장되었습니다.');
    }

    loadMealDiary() {
        const mealText = localStorage.getItem(`mealDiary_${this.currentDate}`) || '';
        document.getElementById('mealDiary').value = mealText;
    }

    recordWakeUp() {
        const now = new Date();
        const timeString = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        document.getElementById('wakeUpTime').textContent = timeString;
        this.saveHealthData();
    }

    recordSleep() {
        const now = new Date();
        const timeString = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        document.getElementById('sleepTime').textContent = timeString;
        this.saveHealthData();
    }

    recordMedicine(timeOfDay) {
        const now = new Date();
        const timeString = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        
        if (timeOfDay === 'morning') {
            const morningTimeDisplay = document.getElementById('morningMedicineTime');
            if (morningTimeDisplay.textContent !== '미복용') {
                if (confirm('오전 당뇨약 시간을 다시 기록하시겠습니까?')) {
                    morningTimeDisplay.textContent = timeString;
                }
            } else {
                morningTimeDisplay.textContent = timeString;
            }
        } else if (timeOfDay === 'evening') {
            const eveningTimeDisplay = document.getElementById('eveningMedicineTime');
            if (eveningTimeDisplay.textContent !== '미복용') {
                if (confirm('오후 당뇨약 시간을 다시 기록하시겠습니까?')) {
                    eveningTimeDisplay.textContent = timeString;
                }
            } else {
                eveningTimeDisplay.textContent = timeString;
            }
        }
        
        this.saveHealthData();
    }

    updateFastingTime() {
        const mealText = document.getElementById('mealDiary').value;
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        
        const yesterdayKey = yesterday.toISOString().split('T')[0];
        const yesterdayMeal = localStorage.getItem(`mealDiary_${yesterdayKey}`) || '';
        
        const fastingDisplay = document.getElementById('fastingTime');
        
        // 오늘 첫 식사시간 찾기
        const todayFirstMeal = this.extractFirstMealTime(mealText);
        
        if (!todayFirstMeal) {
            // 오늘 식사 기록이 없으면 단식중 표시
            fastingDisplay.textContent = '단식중';
            return;
        }
        
        // 어제 마지막 식사시간 찾기
        const yesterdayLastMeal = this.extractLastMealTime(yesterdayMeal);
        
        if (!yesterdayLastMeal) {
            // 어제 식사 기록이 없으면 계산 불가
            fastingDisplay.textContent = '계산불가';
            return;
        }
        
        // 단식 시간 계산
        const fastingHours = this.calculateFastingTime(yesterdayLastMeal, todayFirstMeal);
        fastingDisplay.textContent = `${fastingHours}시간`;
    }

    extractFirstMealTime(mealText) {
        const lines = mealText.split('\n').filter(line => line.trim());
        for (const line of lines) {
            const timeMatch = line.match(/^(\d{2}):(\d{2})/);
            if (timeMatch) {
                return { hours: parseInt(timeMatch[1]), minutes: parseInt(timeMatch[2]) };
            }
        }
        return null;
    }

    extractLastMealTime(mealText) {
        const lines = mealText.split('\n').filter(line => line.trim());
        for (let i = lines.length - 1; i >= 0; i--) {
            const timeMatch = lines[i].match(/^(\d{2}):(\d{2})/);
            if (timeMatch) {
                return { hours: parseInt(timeMatch[1]), minutes: parseInt(timeMatch[2]) };
            }
        }
        return null;
    }

    calculateFastingTime(lastMeal, firstMeal) {
        // 어제 마지막 식사시간을 분으로 변환
        const lastMealMinutes = lastMeal.hours * 60 + lastMeal.minutes;
        
        // 오늘 첫 식사시간을 분으로 변환 (24시간 추가)
        const firstMealMinutes = (firstMeal.hours * 60 + firstMeal.minutes) + (24 * 60);
        
        // 단식 시간 계산 (분)
        const fastingMinutes = firstMealMinutes - lastMealMinutes;
        
        // 시간으로 변환 (소수점 첫째자리까지)
        return Math.round(fastingMinutes / 60 * 10) / 10;
    }

    saveHealthData() {
        const healthData = {
            wakeUpTime: document.getElementById('wakeUpTime').textContent,
            sleepTime: document.getElementById('sleepTime').textContent,
            morningMedicineTime: document.getElementById('morningMedicineTime').textContent,
            eveningMedicineTime: document.getElementById('eveningMedicineTime').textContent
        };
        localStorage.setItem(`healthData_${this.currentDate}`, JSON.stringify(healthData));
    }

    loadHealthData() {
        const healthData = JSON.parse(localStorage.getItem(`healthData_${this.currentDate}`) || '{}');
        
        if (healthData.wakeUpTime && healthData.wakeUpTime !== '미기록') {
            document.getElementById('wakeUpTime').textContent = healthData.wakeUpTime;
        }
        
        if (healthData.sleepTime && healthData.sleepTime !== '미기록') {
            document.getElementById('sleepTime').textContent = healthData.sleepTime;
        }
        
        if (healthData.morningMedicineTime && healthData.morningMedicineTime !== '미복용') {
            document.getElementById('morningMedicineTime').textContent = healthData.morningMedicineTime;
        }
        
        if (healthData.eveningMedicineTime && healthData.eveningMedicineTime !== '미복용') {
            document.getElementById('eveningMedicineTime').textContent = healthData.eveningMedicineTime;
        }
        
        this.updateFastingTime();
    }

    updateStats() {
        const history = JSON.parse(localStorage.getItem('healthTrackerHistory') || '[]');
        
        // 이번 주 총 운동량 계산
        const thisWeekTotal = this.calculateWeeklyTotal(history);
        document.getElementById('weeklyTotal').textContent = thisWeekTotal;
        
        // 연속 운동 일수 계산
        const streakDays = this.calculateStreak(history);
        document.getElementById('streakDays').textContent = `${streakDays}일`;
        
        // 평균 일일 운동량 계산
        const dailyAvg = history.length > 0 ? Math.round(thisWeekTotal / 7) : 0;
        document.getElementById('dailyAvg').textContent = dailyAvg;
    }

    calculateWeeklyTotal(history) {
        const today = new Date();
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - today.getDay()); // 이번 주 일요일
        
        let total = 0;
        for (let i = 0; i < 7; i++) {
            const date = new Date(weekStart);
            date.setDate(weekStart.getDate() + i);
            const dateString = date.toISOString().split('T')[0];
            
            const dayData = history.find(item => item.date === dateString);
            if (dayData) {
                total += dayData.exercises.reduce((sum, ex) => sum + ex.count, 0);
            }
        }
        
        // 오늘 데이터도 추가
        total += this.exercises.reduce((sum, ex) => sum + ex.count, 0);
        
        return total;
    }

    calculateStreak(history) {
        const sortedHistory = [...history].sort((a, b) => new Date(b.date) - new Date(a.date));
        let streak = 0;
        
        // 오늘 운동했는지 확인
        const todayTotal = this.exercises.reduce((sum, ex) => sum + ex.count, 0);
        if (todayTotal > 0) {
            streak = 1;
        }
        
        // 연속된 운동 일수 계산
        const today = new Date().toISOString().split('T')[0];
        let checkDate = new Date();
        checkDate.setDate(checkDate.getDate() - 1); // 어제부터 확인
        
        for (const dayData of sortedHistory) {
            const exerciseTotal = dayData.exercises.reduce((sum, ex) => sum + ex.count, 0);
            const dateString = checkDate.toISOString().split('T')[0];
            
            if (dayData.date === dateString && exerciseTotal > 0) {
                streak++;
                checkDate.setDate(checkDate.getDate() - 1);
            } else if (dayData.date === dateString) {
                break;
            }
        }
        
        return streak;
    }

    saveData() {
        const data = {
            exercises: this.exercises,
            bookmarks: this.bookmarks,
            medicineCount: this.medicineCount
        };
        localStorage.setItem(`healthTracker_${this.currentDate}`, JSON.stringify(data));
    }

    loadData() {
        const data = JSON.parse(localStorage.getItem(`healthTracker_${this.currentDate}`) || '{}');
        
        if (data.exercises) {
            this.exercises = data.exercises;
        }
        
        if (data.bookmarks) {
            this.bookmarks = data.bookmarks;
        }
        
        if (data.medicineCount !== undefined) {
            this.medicineCount = data.medicineCount;
        }
    }
}

// 앱 초기화
document.addEventListener('DOMContentLoaded', () => {
    new HealthTracker();
});