import { showModal, hideModal } from '../../../components/modal.js';
import { showToast } from '../../../components/toast.js';
import { loadAndRenderWallets } from '../table.js';

/**
 * 打开批量生成钱包模态框。
 */
export async function openGenerateWalletsModal() {
    showModal('tpl-generate-wallets', async (modalElement) => {
        const form = modalElement.querySelector('#generate-wallet-form');
        const countInput = modalElement.querySelector('#generate-count');
        const groupSelect = modalElement.querySelector('#generate-group');
        const generateBtn = modalElement.querySelector('.modal-generate-btn');
        const cancelBtn = modalElement.querySelector('.modal-cancel-btn');
        const progressDiv = modalElement.querySelector('#generate-progress');
        const progressBar = progressDiv?.querySelector('progress');
        const progressText = progressDiv?.querySelector('#generate-progress-text');

        if (!form || !countInput || !groupSelect || !generateBtn || !cancelBtn || !progressDiv || !progressBar || !progressText) {
            console.error(`[${Date.now()}] openGenerateWalletsModal: Missing elements`);
            hideModal(); return;
        }

        // Reset state
        generateBtn.style.display = 'inline-block';
        cancelBtn.style.display = 'inline-block';
        cancelBtn.textContent = '取消';
        progressDiv.style.display = 'none';
        generateBtn.disabled = false;
        generateBtn.innerHTML = '<i class="fa fa-cogs"></i> 开始生成';

        // Focus on input
        requestAnimationFrame(() => countInput.focus());

        // Populate groups
        try {
            const groups = await window.dbAPI.getGroups();
            groupSelect.innerHTML = '<option value="">不指定分组</option>';
            let defaultGroupId = "";
            groups.forEach(group => {
                const option = document.createElement('option');
                option.value = group.id; option.textContent = group.name;
                groupSelect.appendChild(option);
                if (group.name === '默认分组') { defaultGroupId = group.id; }
            });
            if (defaultGroupId) { groupSelect.value = defaultGroupId; }
        } catch (error) { console.error("IPC: 填充生成模态框分组失败:", error); }

        const handleGenerateSubmit = async (event) => {
            event.preventDefault();
            const count = parseInt(countInput.value);
            const groupId = groupSelect.value ? parseInt(groupSelect.value) : null;

            if (isNaN(count) || count <= 0) { showToast("请输入有效的生成数量 (>0)。", 'warning'); return; }
            if (count > 1000) { showToast("一次最多生成 1000 个钱包。", 'warning'); return; }

            generateBtn.disabled = true;
            generateBtn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> 生成中...';
            progressDiv.style.display = 'block';
            progressBar.value = 0; progressBar.max = count;
            progressText.textContent = `正在生成 0 / ${count}...`;

            try {
                console.log(`请求批量生成: ${count} 个钱包, 分组ID: ${groupId}`);
                const result = await window.dbAPI.generateWallets({ count, groupId });
                console.log("批量生成结果:", result);

                let message = `批量生成完成！\n成功生成 ${result.generatedCount} 个钱包。`;
                if (result.errors?.length > 0) {
                    message += `\n\n出现 ${result.errors.length} 个错误:\n - ${result.errors.slice(0, 10).join('\n - ')}`;
                    if (result.errors.length > 10) message += '\n - ... (更多错误请查看控制台)';
                    console.warn("批量生成错误:", result.errors);
                }

                progressBar.value = progressBar.max;
                progressText.innerHTML = message.replace(/\n/g, '<br>');

                generateBtn.style.display = 'none';
                cancelBtn.textContent = '关闭';
                cancelBtn.style.display = 'inline-block';

                // Refresh wallet list in the background
                requestAnimationFrame(() => {
                    setTimeout(loadAndRenderWallets, 0);
                });

            } catch (error) {
                console.error("IPC: 调用钱包生成功能失败:", error);
                progressText.textContent = `批量生成过程中发生错误: ${error.message}`;
                progressText.style.color = 'red';
                generateBtn.disabled = false;
                generateBtn.innerHTML = '<i class="fa fa-cogs"></i> 重新生成';
                generateBtn.style.display = 'inline-block';
                cancelBtn.style.display = 'inline-block';
                cancelBtn.textContent = '取消';
            }
        };

        form.removeEventListener('submit', handleGenerateSubmit);
        form.addEventListener('submit', handleGenerateSubmit);

        // 确保取消按钮可以关闭模态框
        cancelBtn.removeEventListener('click', hideModal);
        cancelBtn.addEventListener('click', hideModal);
    });
} 