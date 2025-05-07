// 脚本详情页面配置模块

/**
 * 收集配置表单数据
 * @param {HTMLElement} container - 详情页面容器元素
 * @returns {Object} 配置数据对象
 */
export function collectConfigFormData(container) {
    const configForm = container.querySelector('#scriptConfigForm');
    if (!configForm) {
        console.log('未找到配置表单元素');
        return {};
    }
    
    const config = {};
    
    // 收集文本和数字输入
    const textInputs = configForm.querySelectorAll('input[type="text"], input[type="number"]');
    textInputs.forEach(input => {
        const name = input.getAttribute('name') || input.id;
        if (name) {
            if (input.type === 'number') {
                config[name] = parseFloat(input.value) || 0;
            } else {
                config[name] = input.value;
            }
        }
    });
    
    // 收集下拉选择
    const selects = configForm.querySelectorAll('select');
    selects.forEach(select => {
        const name = select.getAttribute('name') || select.id;
        if (name) {
            config[name] = select.value;
        }
    });
    
    // 收集复选框
    const checkboxes = configForm.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
        const name = checkbox.getAttribute('name') || checkbox.id;
        if (name) {
            config[name] = checkbox.checked;
        }
    });
    
    // 收集单选按钮
    const checkedRadios = configForm.querySelectorAll('input[type="radio"]:checked');
    checkedRadios.forEach(radio => {
        const name = radio.getAttribute('name');
        if (name) {
            config[name] = radio.value;
        }
    });
    
    // 收集网络连接配置
    try {
        // 添加代理设置到配置中
        const useProxy = container.querySelector('#proxyConnection')?.checked;
        config.useProxy = !!useProxy;
        
        if (useProxy) {
            const proxySelect = container.querySelector('#proxySelect');
            if (proxySelect && proxySelect.value) {
                config.proxyId = proxySelect.value;
            }
        }
    } catch (e) {
        console.error('收集代理配置出错:', e);
    }
    
    console.log('收集的配置数据:', config);
    return config;
}

/**
 * 初始化配置表单
 * @param {HTMLElement} container - 详情页面容器元素
 * @param {Object} scriptInfo - 脚本信息对象
 */
export function initConfigForm(container, scriptInfo) {
    const configContainer = container.querySelector('#scriptConfigForm');
    if (!configContainer) return;
    
    // 清空容器
    configContainer.innerHTML = '';
    
    // 如果没有配置项，显示提示信息
    if (!scriptInfo.config || Object.keys(scriptInfo.config).length === 0) {
        configContainer.innerHTML = '<div class="empty-config">此脚本没有可配置项</div>';
        return;
    }
    
    // 为每个配置项创建表单元素
    Object.entries(scriptInfo.config).forEach(([key, value]) => {
        // 跳过非必要的内部属性
        if (key.startsWith('_')) return;
        
        // 根据值类型创建不同的表单控件
        const formGroup = document.createElement('div');
        formGroup.className = 'form-group';
        
        // 创建标签
        const label = document.createElement('label');
        label.setAttribute('for', key);
        label.textContent = formatConfigKey(key);
        formGroup.appendChild(label);
        
        // 根据值类型创建控件
        let input;
        
        if (typeof value === 'boolean') {
            // 复选框
            input = document.createElement('input');
            input.type = 'checkbox';
            input.id = key;
            input.name = key;
            input.checked = value;
            
            // 包装在开关样式容器中
            const switchContainer = document.createElement('div');
            switchContainer.className = 'switch-container';
            switchContainer.appendChild(input);
            
            const slider = document.createElement('span');
            slider.className = 'slider';
            switchContainer.appendChild(slider);
            
            formGroup.appendChild(switchContainer);
        } else if (typeof value === 'number') {
            // 数字输入
            input = document.createElement('input');
            input.type = 'number';
            input.id = key;
            input.name = key;
            input.value = value;
            input.step = key.includes('price') || key.includes('amount') ? '0.01' : '1';
            formGroup.appendChild(input);
        } else if (Array.isArray(value)) {
            // 下拉列表（多选值）
            input = document.createElement('select');
            input.id = key;
            input.name = key;
            
            // 添加占位符选项
            const placeholderOption = document.createElement('option');
            placeholderOption.value = '';
            placeholderOption.textContent = `请选择${formatConfigKey(key)}`;
            placeholderOption.disabled = true;
            placeholderOption.selected = true;
            input.appendChild(placeholderOption);
            
            // 添加选项
            value.forEach(option => {
                const optionElement = document.createElement('option');
                optionElement.value = option;
                optionElement.textContent = option;
                input.appendChild(optionElement);
            });
            
            formGroup.appendChild(input);
        } else {
            // 文本输入（默认）
            input = document.createElement('input');
            input.type = 'text';
            input.id = key;
            input.name = key;
            input.value = value || '';
            
            // 地址字段特殊处理
            if (key.includes('address') || key.includes('contract')) {
                input.placeholder = '0x...';
                input.pattern = '^0x[a-fA-F0-9]{40}$';
                
                // 添加验证提示
                const hint = document.createElement('div');
                hint.className = 'form-hint';
                hint.textContent = '请输入有效的以太坊地址';
                formGroup.appendChild(input);
                formGroup.appendChild(hint);
            } else {
                formGroup.appendChild(input);
            }
        }
        
        configContainer.appendChild(formGroup);
    });
    
    // 添加执行选项（如Gas策略、执行间隔等）
    addExecutionOptions(configContainer);
}

/**
 * 添加执行选项
 * @param {HTMLElement} container - 配置表单容器
 */
function addExecutionOptions(container) {
    // 创建执行选项区域
    const executionSection = document.createElement('div');
    executionSection.className = 'execution-options';
    
    const sectionTitle = document.createElement('h4');
    sectionTitle.textContent = '执行选项';
    executionSection.appendChild(sectionTitle);
    
    // Gas策略选择
    const gasGroup = document.createElement('div');
    gasGroup.className = 'form-group';
    
    const gasLabel = document.createElement('label');
    gasLabel.setAttribute('for', 'gasStrategy');
    gasLabel.textContent = 'Gas策略';
    gasGroup.appendChild(gasLabel);
    
    const gasSelect = document.createElement('select');
    gasSelect.id = 'gasStrategy';
    gasSelect.name = 'gasStrategy';
    
    const gasOptions = [
        { value: 'economy', text: '经济模式 (较慢)' },
        { value: 'balanced', text: '均衡模式 (推荐)' },
        { value: 'fast', text: '快速模式 (较贵)' },
        { value: 'custom', text: '自定义' }
    ];
    
    gasOptions.forEach(option => {
        const optionElement = document.createElement('option');
        optionElement.value = option.value;
        optionElement.textContent = option.text;
        if (option.value === 'balanced') {
            optionElement.selected = true;
        }
        gasSelect.appendChild(optionElement);
    });
    
    gasGroup.appendChild(gasSelect);
    executionSection.appendChild(gasGroup);
    
    // 执行间隔设置
    const intervalGroup = document.createElement('div');
    intervalGroup.className = 'form-group';
    
    const intervalLabel = document.createElement('label');
    intervalLabel.textContent = '执行间隔 (分钟)';
    intervalGroup.appendChild(intervalLabel);
    
    const intervalContainer = document.createElement('div');
    intervalContainer.className = 'interval-inputs';
    
    const minInput = document.createElement('input');
    minInput.type = 'number';
    minInput.id = 'intervalMin';
    minInput.name = 'intervalMin';
    minInput.value = '1';
    minInput.min = '0.1';
    minInput.step = '0.1';
    
    const maxInput = document.createElement('input');
    maxInput.type = 'number';
    maxInput.id = 'intervalMax';
    maxInput.name = 'intervalMax';
    maxInput.value = '1';
    maxInput.min = '0.1';
    maxInput.step = '0.1';
    
    const intervalText = document.createTextNode(' 至 ');
    
    intervalContainer.appendChild(minInput);
    intervalContainer.appendChild(intervalText);
    intervalContainer.appendChild(maxInput);
    
    intervalGroup.appendChild(intervalContainer);
    
    // 随机间隔选项
    const randomIntervalContainer = document.createElement('div');
    randomIntervalContainer.className = 'form-check mt-2';
    
    const randomCheck = document.createElement('input');
    randomCheck.type = 'checkbox';
    randomCheck.id = 'randomInterval';
    randomCheck.name = 'randomInterval';
    randomCheck.checked = true;
    
    const randomLabel = document.createElement('label');
    randomLabel.setAttribute('for', 'randomInterval');
    randomLabel.textContent = '使用随机间隔（防机器人检测）';
    randomLabel.className = 'form-check-label';
    
    randomIntervalContainer.appendChild(randomCheck);
    randomIntervalContainer.appendChild(randomLabel);
    
    intervalGroup.appendChild(randomIntervalContainer);
    executionSection.appendChild(intervalGroup);
    
    // 添加执行选项区域到容器
    container.appendChild(executionSection);
}

/**
 * 将配置键名格式化为用户友好的标签
 * @param {string} key - 配置键名
 * @returns {string} 格式化后的标签文本
 */
function formatConfigKey(key) {
    // 将驼峰命名转换为空格分隔
    const formatted = key.replace(/([A-Z])/g, ' $1').toLowerCase();
    
    // 首字母大写
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
} 