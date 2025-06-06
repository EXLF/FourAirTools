import { showModal, hideModal } from '../../../components/modal.js';
import { showToast } from '../../../components/toast.js';
import { loadAndRenderWallets, loadGroupFilters } from '../table.js';

/**
 * 打开分组管理模态框。
 */
export async function openManageGroupsModal() {
     showModal('tpl-manage-groups', async (modalElement) => {
        const groupListElement = modalElement.querySelector('.group-list');
        const newGroupNameInput = modalElement.querySelector('#new-group-name');
        const addGroupBtn = modalElement.querySelector('.add-group-btn');

        if (!groupListElement || !newGroupNameInput || !addGroupBtn) {
            console.error("分组管理模态框缺少必要的元素 (.group-list, #new-group-name, .add-group-btn)。");
            hideModal(); return;
        }

        const renderGroupList = async () => {
            groupListElement.innerHTML = '加载中...';
            try {
                const groups = await window.dbAPI.getGroups();
                groupListElement.innerHTML = ''; 
                if (groups.length === 0) {
                    groupListElement.innerHTML = '<li style="padding: 10px; text-align: center; color: #888;">暂无分组。</li>';
                    return;
                }
                groups.forEach(group => {
                    const li = document.createElement('li');
                    li.dataset.id = group.id;
                    li.style.cssText = `display: flex; justify-content: space-between; align-items: center; padding: 10px 5px; border-bottom: 1px solid #eee;`;

                    const nameSpan = document.createElement('span');
                    nameSpan.textContent = group.name;
                    nameSpan.style.cssText = `flex-grow: 1; margin-right: 10px;`;

                    const actionsDiv = document.createElement('div');
                    actionsDiv.className = 'group-actions';
                    actionsDiv.style.flexShrink = '0';

                    const editBtn = document.createElement('button');
                    editBtn.innerHTML = '<i class="fa fa-edit"></i>';
                    editBtn.title = '重命名';
                    editBtn.className = 'btn-icon btn-icon-sm';
                    editBtn.style.marginRight = '5px';
                    
                    editBtn.addEventListener('click', () => {
                        li.classList.add('editing');
                        nameSpan.style.display = 'none';
                        actionsDiv.style.display = 'none';

                        const input = document.createElement('input');
                        input.type = 'text'; input.value = group.name;
                        input.className = 'input input-sm group-edit-input';
                        input.style.cssText = `flex-grow: 1; margin-right: 10px; font-size: 14px; padding: 8px 12px; height: auto; border-radius: 4px; border: 1px solid #ddd;`;

                        const saveBtn = document.createElement('button');
                        saveBtn.innerHTML = '<i class="fas fa-check"></i>'; saveBtn.title = '保存';
                        saveBtn.className = 'btn-icon btn-icon-sm btn-success'; saveBtn.style.marginRight = '5px';

                        const cancelBtn = document.createElement('button');
                        cancelBtn.innerHTML = '<i class="fas fa-times"></i>'; cancelBtn.title = '取消';
                        cancelBtn.className = 'btn-icon btn-icon-sm btn-secondary';

                        const editControls = document.createElement('div');
                        editControls.className = 'group-edit-controls';
                        editControls.style.cssText = `display: flex; align-items: center; flex-grow: 1;`;
                        editControls.appendChild(input); editControls.appendChild(saveBtn); editControls.appendChild(cancelBtn);
                        
                        li.insertBefore(editControls, nameSpan);
                        input.focus(); input.select();

                        const cancelEdit = () => {
                            li.removeChild(editControls);
                            nameSpan.style.display = '';
                            actionsDiv.style.display = '';
                            li.classList.remove('editing');
                        };

                        saveBtn.addEventListener('click', async () => {
                            const newName = input.value.trim();
                            if (!newName) { showToast('分组名称不能为空', 'warning'); return; }
                            if (newName === group.name) { cancelEdit(); return; }
                            
                            const otherGroupNames = Array.from(groupListElement.querySelectorAll('li:not(.editing) span')).map(span => span.textContent.toLowerCase());
                            if (otherGroupNames.includes(newName.toLowerCase())) {
                                showToast(`分组名称 "${newName}" 已存在`, 'warning'); return;
                            }

                            saveBtn.disabled = true; saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
                            try {
                                await window.dbAPI.updateGroup(group.id, newName);
                                showToast(`分组已重命名为 "${newName}"`, 'success');
                                group.name = newName;
                                nameSpan.textContent = newName;
                                cancelEdit();
                                await loadGroupFilters(); // 刷新主页筛选器
                            } catch (error) {
                                if (error.message?.includes('UNIQUE constraint failed')) {
                                    showToast(`重命名失败：分组名称 "${newName}" 已存在！`, 'error');
                                } else { showToast(`重命名分组失败: ${error.message}`, 'error'); }
                                saveBtn.disabled = false; saveBtn.innerHTML = '<i class="fas fa-check"></i>';
                            }
                        });
                        cancelBtn.addEventListener('click', cancelEdit);
                        input.addEventListener('keydown', (e) => {
                            if (e.key === 'Enter') { e.preventDefault(); saveBtn.click(); }
                             else if (e.key === 'Escape') { cancelEdit(); }
                        });
                    });

                    const deleteBtn = document.createElement('button');
                    deleteBtn.innerHTML = '<i class="fa fa-trash"></i>';
                    deleteBtn.title = '删除';
                    deleteBtn.className = 'btn-icon btn-icon-sm';
                     if (group.name === '默认分组') {
                         deleteBtn.disabled = true; deleteBtn.title = '不能删除默认分组';
                         deleteBtn.style.cssText = `opacity: 0.5; cursor: not-allowed;`;
                     } else {
                         deleteBtn.addEventListener('click', async () => {
                            showModal('tpl-confirm-dialog', (confirmModalElement) => {
                                const messageElement = confirmModalElement.querySelector('.confirm-message');
                                const confirmBtnModal = confirmModalElement.querySelector('.modal-confirm-btn');
                                if (!messageElement || !confirmBtnModal) { console.error("确认框元素缺失"); hideModal(); return; }

                                messageElement.innerHTML = `确定删除分组 "<b>${group.name}</b>"？<br>关联的钱包或社交账户将变为"默认分组"。`;

                                const handleConfirmGroupDelete = async () => {
                                    confirmBtnModal.removeEventListener('click', handleConfirmGroupDelete);
                                    hideModal();
                                    try {
                                        await window.dbAPI.deleteGroup(group.id);
                                        showToast(`分组 "${group.name}" 已删除`, 'success');
                                        await renderGroupList(); // 刷新分组列表
                                        await loadGroupFilters(); // 刷新主页筛选器
                                        await loadAndRenderWallets(); // 刷新钱包列表
                                    } catch (error) { showToast(`删除分组失败: ${error.message}`, 'error'); }
                                };
                                confirmBtnModal.addEventListener('click', handleConfirmGroupDelete);
                            });
                         });
                     }

                    actionsDiv.appendChild(editBtn); actionsDiv.appendChild(deleteBtn);
                    li.appendChild(nameSpan); li.appendChild(actionsDiv);
                    groupListElement.appendChild(li);
                });
                if (groupListElement.lastElementChild) { groupListElement.lastElementChild.style.borderBottom = 'none'; }
            } catch (error) {
                console.error("IPC: 加载分组列表失败:", error);
                groupListElement.innerHTML = '<li style="padding: 10px; color:red;">加载分组失败。</li>';
            }
        };

        const handleAddGroup = async () => {
            const name = newGroupNameInput.value.trim();
            if (name) {
                addGroupBtn.disabled = true;
                try {
                    await window.dbAPI.addGroup(name);
                    showToast(`分组 "${name}" 添加成功`, 'success');
                    newGroupNameInput.value = '';
                    await renderGroupList();
                    await loadGroupFilters(); // 刷新主页筛选器
                } catch (error) {
                     if (error.message?.includes('UNIQUE constraint failed')) {
                         showToast(`添加失败：分组名称 "${name}" 已存在！`, 'error');
                     } else { showToast(`添加分组失败: ${error.message}`, 'error'); }
                } finally { addGroupBtn.disabled = false; }
            }
        };

        // Handle form submission via button click or Enter key
        const groupAddContainer = addGroupBtn.closest('.group-add-form');
        if (groupAddContainer) {
             groupAddContainer.addEventListener('submit', (e) => { e.preventDefault(); handleAddGroup(); }); // Submit on form submit
             newGroupNameInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddGroup(); } });
             addGroupBtn.addEventListener('click', handleAddGroup); // Also handle click
        } else {
             // Fallback if structure changes
             addGroupBtn.addEventListener('click', handleAddGroup);
             newGroupNameInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddGroup(); } });
        }

        await renderGroupList(); // Initial render
     });
} 