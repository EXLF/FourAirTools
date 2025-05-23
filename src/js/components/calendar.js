/**
 * @fileoverview 日历组件
 * @module components/calendar
 * @description 提供日历显示、日期标记、事件管理等功能
 */

/**
 * @typedef {Object} CalendarEvent
 * @property {string} date - 日期 (YYYY-MM-DD)
 * @property {string} title - 事件标题
 * @property {string} [type] - 事件类型
 * @property {string} [color] - 颜色
 * @property {*} [data] - 附加数据
 */

/**
 * @typedef {Object} CalendarOptions
 * @property {HTMLElement} container - 容器元素
 * @property {Date} [initialDate] - 初始日期
 * @property {string} [locale] - 语言环境
 * @property {Function} [onDateClick] - 日期点击回调
 * @property {Function} [onEventClick] - 事件点击回调
 * @property {Function} [onMonthChange] - 月份改变回调
 */

/**
 * 日历组件类
 */
export class Calendar {
    constructor(options) {
        this.container = options.container;
        this.currentDate = options.initialDate || new Date();
        this.locale = options.locale || 'zh-CN';
        this.events = new Map(); // date -> events[]
        
        // 回调函数
        this.onDateClick = options.onDateClick || null;
        this.onEventClick = options.onEventClick || null;
        this.onMonthChange = options.onMonthChange || null;
        
        this.selectedDate = null;
        this.init();
    }
    
    /**
     * 初始化日历
     */
    init() {
        this.container.classList.add('calendar-container');
        this.render();
    }
    
    /**
     * 渲染日历
     */
    render() {
        this.container.innerHTML = '';
        
        // 创建日历头部
        const header = this.createHeader();
        this.container.appendChild(header);
        
        // 创建星期标题
        const weekdays = this.createWeekdays();
        this.container.appendChild(weekdays);
        
        // 创建日期网格
        const grid = this.createDateGrid();
        this.container.appendChild(grid);
        
        // 添加样式
        this.addStyles();
    }
    
    /**
     * 创建日历头部
     */
    createHeader() {
        const header = document.createElement('div');
        header.className = 'calendar-header';
        
        // 上一月按钮
        const prevBtn = document.createElement('button');
        prevBtn.className = 'calendar-nav-btn';
        prevBtn.innerHTML = '<i class="fas fa-chevron-left"></i>';
        prevBtn.onclick = () => this.previousMonth();
        
        // 当前月份年份
        const monthYear = document.createElement('div');
        monthYear.className = 'calendar-month-year';
        monthYear.textContent = this.getMonthYearString();
        
        // 下一月按钮
        const nextBtn = document.createElement('button');
        nextBtn.className = 'calendar-nav-btn';
        nextBtn.innerHTML = '<i class="fas fa-chevron-right"></i>';
        nextBtn.onclick = () => this.nextMonth();
        
        // 今天按钮
        const todayBtn = document.createElement('button');
        todayBtn.className = 'calendar-today-btn';
        todayBtn.textContent = '今天';
        todayBtn.onclick = () => this.goToToday();
        
        header.appendChild(prevBtn);
        header.appendChild(monthYear);
        header.appendChild(nextBtn);
        header.appendChild(todayBtn);
        
        return header;
    }
    
    /**
     * 创建星期标题
     */
    createWeekdays() {
        const weekdays = document.createElement('div');
        weekdays.className = 'calendar-weekdays';
        
        const days = this.getWeekdayNames();
        days.forEach(day => {
            const dayElement = document.createElement('div');
            dayElement.className = 'calendar-weekday';
            dayElement.textContent = day;
            weekdays.appendChild(dayElement);
        });
        
        return weekdays;
    }
    
    /**
     * 创建日期网格
     */
    createDateGrid() {
        const grid = document.createElement('div');
        grid.className = 'calendar-grid';
        
        const dates = this.getCalendarDates();
        
        dates.forEach(dateInfo => {
            const dateElement = this.createDateElement(dateInfo);
            grid.appendChild(dateElement);
        });
        
        return grid;
    }
    
    /**
     * 创建日期元素
     */
    createDateElement(dateInfo) {
        const element = document.createElement('div');
        element.className = 'calendar-date';
        
        // 添加类名
        if (dateInfo.isOtherMonth) {
            element.classList.add('other-month');
        }
        if (dateInfo.isToday) {
            element.classList.add('today');
        }
        if (dateInfo.isSelected) {
            element.classList.add('selected');
        }
        
        // 日期数字
        const dateNumber = document.createElement('div');
        dateNumber.className = 'date-number';
        dateNumber.textContent = dateInfo.day;
        element.appendChild(dateNumber);
        
        // 事件指示器
        const events = this.getEventsForDate(dateInfo.dateStr);
        if (events.length > 0) {
            const indicator = document.createElement('div');
            indicator.className = 'event-indicator';
            
            // 显示事件点或数量
            if (events.length <= 3) {
                events.forEach(event => {
                    const dot = document.createElement('span');
                    dot.className = 'event-dot';
                    if (event.color) {
                        dot.style.backgroundColor = event.color;
                    }
                    indicator.appendChild(dot);
                });
            } else {
                indicator.textContent = `${events.length}+`;
                indicator.classList.add('event-count');
            }
            
            element.appendChild(indicator);
        }
        
        // 点击事件
        element.onclick = () => this.handleDateClick(dateInfo);
        
        // 存储日期信息
        element.dataset.date = dateInfo.dateStr;
        
        return element;
    }
    
    /**
     * 获取日历日期数据
     */
    getCalendarDates() {
        const year = this.currentDate.getFullYear();
        const month = this.currentDate.getMonth();
        
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        
        const dates = [];
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        // 获取第一天是星期几（0=周日）
        let startDay = firstDay.getDay();
        // 调整为周一开始
        startDay = startDay === 0 ? 6 : startDay - 1;
        
        // 添加上月日期
        for (let i = startDay - 1; i >= 0; i--) {
            const date = new Date(firstDay);
            date.setDate(date.getDate() - i - 1);
            dates.push({
                date: date,
                dateStr: this.formatDate(date),
                day: date.getDate(),
                isOtherMonth: true,
                isToday: date.getTime() === today.getTime(),
                isSelected: this.isSelectedDate(date)
            });
        }
        
        // 添加本月日期
        for (let day = 1; day <= lastDay.getDate(); day++) {
            const date = new Date(year, month, day);
            dates.push({
                date: date,
                dateStr: this.formatDate(date),
                day: day,
                isOtherMonth: false,
                isToday: date.getTime() === today.getTime(),
                isSelected: this.isSelectedDate(date)
            });
        }
        
        // 添加下月日期，补齐6行
        const remainingDays = 42 - dates.length;
        for (let day = 1; day <= remainingDays; day++) {
            const date = new Date(year, month + 1, day);
            dates.push({
                date: date,
                dateStr: this.formatDate(date),
                day: day,
                isOtherMonth: true,
                isToday: date.getTime() === today.getTime(),
                isSelected: this.isSelectedDate(date)
            });
        }
        
        return dates;
    }
    
    /**
     * 获取星期名称
     */
    getWeekdayNames() {
        return ['一', '二', '三', '四', '五', '六', '日'];
    }
    
    /**
     * 获取月份年份字符串
     */
    getMonthYearString() {
        return this.currentDate.toLocaleDateString(this.locale, {
            year: 'numeric',
            month: 'long'
        });
    }
    
    /**
     * 格式化日期
     */
    formatDate(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
    
    /**
     * 检查是否为选中日期
     */
    isSelectedDate(date) {
        if (!this.selectedDate) return false;
        return this.formatDate(date) === this.formatDate(this.selectedDate);
    }
    
    /**
     * 处理日期点击
     */
    handleDateClick(dateInfo) {
        this.selectedDate = dateInfo.date;
        this.render();
        
        if (this.onDateClick) {
            const events = this.getEventsForDate(dateInfo.dateStr);
            this.onDateClick(dateInfo, events);
        }
    }
    
    /**
     * 上一月
     */
    previousMonth() {
        this.currentDate.setMonth(this.currentDate.getMonth() - 1);
        this.render();
        
        if (this.onMonthChange) {
            this.onMonthChange(this.currentDate);
        }
    }
    
    /**
     * 下一月
     */
    nextMonth() {
        this.currentDate.setMonth(this.currentDate.getMonth() + 1);
        this.render();
        
        if (this.onMonthChange) {
            this.onMonthChange(this.currentDate);
        }
    }
    
    /**
     * 跳转到今天
     */
    goToToday() {
        this.currentDate = new Date();
        this.selectedDate = new Date();
        this.render();
    }
    
    /**
     * 添加事件
     */
    addEvent(date, event) {
        const dateStr = typeof date === 'string' ? date : this.formatDate(date);
        
        if (!this.events.has(dateStr)) {
            this.events.set(dateStr, []);
        }
        
        this.events.get(dateStr).push({
            ...event,
            date: dateStr
        });
        
        this.render();
    }
    
    /**
     * 批量添加事件
     */
    addEvents(events) {
        events.forEach(event => {
            this.addEvent(event.date, event);
        });
    }
    
    /**
     * 获取指定日期的事件
     */
    getEventsForDate(dateStr) {
        return this.events.get(dateStr) || [];
    }
    
    /**
     * 清除所有事件
     */
    clearEvents() {
        this.events.clear();
        this.render();
    }
    
    /**
     * 清除指定日期的事件
     */
    clearDateEvents(date) {
        const dateStr = typeof date === 'string' ? date : this.formatDate(date);
        this.events.delete(dateStr);
        this.render();
    }
    
    /**
     * 设置当前月份
     */
    setMonth(year, month) {
        this.currentDate = new Date(year, month, 1);
        this.render();
    }
    
    /**
     * 添加样式
     */
    addStyles() {
        if (document.getElementById('calendar-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'calendar-styles';
        style.textContent = `
            .calendar-container {
                background: white;
                border-radius: 8px;
                padding: 20px;
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
            }
            
            .calendar-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                margin-bottom: 20px;
            }
            
            .calendar-nav-btn,
            .calendar-today-btn {
                background: #f0f0f0;
                border: none;
                padding: 8px 12px;
                border-radius: 4px;
                cursor: pointer;
                transition: background-color 0.2s;
            }
            
            .calendar-nav-btn:hover,
            .calendar-today-btn:hover {
                background: #e0e0e0;
            }
            
            .calendar-month-year {
                font-size: 18px;
                font-weight: 600;
                color: #333;
            }
            
            .calendar-weekdays {
                display: grid;
                grid-template-columns: repeat(7, 1fr);
                gap: 5px;
                margin-bottom: 10px;
            }
            
            .calendar-weekday {
                text-align: center;
                font-size: 14px;
                font-weight: 600;
                color: #666;
                padding: 5px;
            }
            
            .calendar-grid {
                display: grid;
                grid-template-columns: repeat(7, 1fr);
                gap: 5px;
            }
            
            .calendar-date {
                aspect-ratio: 1;
                border: 1px solid #eee;
                border-radius: 4px;
                padding: 5px;
                cursor: pointer;
                position: relative;
                display: flex;
                flex-direction: column;
                align-items: center;
                transition: all 0.2s;
            }
            
            .calendar-date:hover {
                background: #f5f5f5;
                border-color: #ddd;
            }
            
            .calendar-date.other-month {
                color: #ccc;
            }
            
            .calendar-date.today {
                background: #e3f2fd;
                border-color: #2196f3;
                font-weight: 600;
            }
            
            .calendar-date.selected {
                background: #2196f3;
                color: white;
                border-color: #1976d2;
            }
            
            .date-number {
                font-size: 14px;
                margin-bottom: 2px;
            }
            
            .event-indicator {
                display: flex;
                gap: 2px;
                position: absolute;
                bottom: 3px;
            }
            
            .event-dot {
                width: 4px;
                height: 4px;
                border-radius: 50%;
                background: #4caf50;
            }
            
            .event-count {
                font-size: 10px;
                background: #ff9800;
                color: white;
                padding: 0 4px;
                border-radius: 10px;
            }
        `;
        
        document.head.appendChild(style);
    }
}

/**
 * 创建日历的便捷函数
 */
export function createCalendar(container, options = {}) {
    return new Calendar({
        container,
        ...options
    });
} 