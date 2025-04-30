// 表格行点击事件处理
document.querySelector('.proxies-table tbody').addEventListener('click', function(e) {
    const row = e.target.closest('tr');
    if (!row) return;
    
    // 如果点击的是按钮或者复选框，不处理行点击事件
    if (e.target.closest('.btn-icon') || e.target.closest('input[type="checkbox"]')) {
        return;
    }
    
    // 获取行的复选框
    const checkbox = row.querySelector('input[type="checkbox"]');
    if (checkbox) {
        checkbox.checked = !checkbox.checked;
        // 触发 change 事件
        checkbox.dispatchEvent(new Event('change'));
        
        // 更新行的选中状态样式
        row.classList.toggle('selected', checkbox.checked);
    }
});

// 复选框change事件处理
document.querySelector('.proxies-table tbody').addEventListener('change', function(e) {
    if (e.target.matches('input[type="checkbox"]')) {
        const row = e.target.closest('tr');
        if (row) {
            row.classList.toggle('selected', e.target.checked);
        }
    }
}); 