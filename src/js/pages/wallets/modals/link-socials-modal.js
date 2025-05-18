import { showModal, hideModal } from '../../../components/modal.js';
import { showToast } from '../../../components/toast.js';
import { loadAndRenderWallets } from '../table.js';
import { truncateAddress } from '../../../utils/index.js';
import { debounce } from '../../../utils/index.js';
import { getPlatformIconClass } from '../table.js';

const ALL_SOCIALS_ROWS_PER_PAGE = 8;
const LINKED_SOCIALS_ROWS_PER_PAGE = 8;

/**
 * 显示用于管理钱包关联社交账户的模态框 (带标签页、搜索和分页)
 * @param {number} walletId - 钱包 ID
 * @param {string} walletAddress - 钱包地址 (用于显示)
 * @param {string|null} [walletName] - 钱包名称 (可选)
 */
export async function showLinkSocialsModal(walletId, walletAddress, walletName) {
    const template = document.getElementById('tpl-link-socials-modal');
    if (!template) {
        showToast('无法找到关联社交账户模态框模板', 'error');
        return;
    }

    const modalClone = template.content.cloneNode(true);
    const modalOverlay = modalClone.querySelector('.modal-overlay');
    const modalBox = modalClone.querySelector('.modal-box');
    const closeButton = modalClone.querySelector('.modal-close-btn');
    const cancelButton = modalClone.querySelector('.modal-cancel-btn');
    const saveButton = modalClone.querySelector('.modal-save-btn');
    const addressPlaceholder = modalClone.querySelector('.wallet-address-placeholder');
    const searchInput = modalClone.querySelector('.search-social-input');
    const tabsContainer = modalClone.querySelector('.tabs-container');
    const tabContentContainer = modalClone.querySelector('.tab-content-container');
    const initialLoadingMessage = tabContentContainer.querySelector('#pane-all .loading-socials-message');
    const allPanePaginationContainer = tabContentContainer.querySelector('#pane-all .all-pane-pagination');
    
    addressPlaceholder.textContent = truncateAddress(walletAddress);

    const closeModal = () => modalOverlay.remove();
    closeButton.addEventListener('click', closeModal);
    cancelButton.addEventListener('click', closeModal);
    modalOverlay.addEventListener('click', (e) => { if (e.target === modalOverlay) closeModal(); });

    document.body.appendChild(modalClone);
    requestAnimationFrame(() => {
        modalOverlay.classList.add('visible');
        modalBox.classList.add('visible');
    });

    let allSocialsData = [];
    let allSocialsCurrentPage = 1;
    let selectedSocialIdsSet = new Set();

    function createSocialItemElement(social) {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'social-link-item';
        itemDiv.style.cssText = 'display: flex; align-items: center; padding: 8px 5px; border-bottom: 1px solid #eee;';
        itemDiv.dataset.searchableContent = `${social.platform} ${social.identifier} ${social.binding || ''} ${social.notes || ''}`.toLowerCase();

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `social-link-${social.id}`;
        checkbox.value = social.id;
        checkbox.checked = social.isLinked;
        checkbox.style.marginRight = '10px';
        checkbox.style.flexShrink = '0';

        checkbox.addEventListener('change', (event) => {
            const socialId = parseInt(event.target.value);
            if (event.target.checked) {
                selectedSocialIdsSet.add(socialId);
            } else {
                selectedSocialIdsSet.delete(socialId);
            }
        });

        const icon = document.createElement('i');
        icon.className = getPlatformIconClass(social.platform);
        icon.style.marginRight = '8px';
        icon.style.width = '16px';
        icon.style.flexShrink = '0';

        const label = document.createElement('label');
        label.htmlFor = checkbox.id;
        label.style.cursor = 'pointer';
        label.style.display = 'flex';
        label.style.flexDirection = 'column';
        label.style.flexGrow = '1';
        label.style.overflow = 'hidden';

        const usernameSpan = document.createElement('span');
        usernameSpan.textContent = `${social.platform}: ${social.identifier}`;
        usernameSpan.style.fontWeight = '500';
        usernameSpan.style.whiteSpace = 'nowrap';
        usernameSpan.style.overflow = 'hidden';
        usernameSpan.style.textOverflow = 'ellipsis';

        const detailsSpan = document.createElement('span');
        const detailsText = social.binding || social.notes || '';
        detailsSpan.textContent = detailsText;
        detailsSpan.style.fontSize = '0.85em';
        detailsSpan.style.color = '#666';
        detailsSpan.style.whiteSpace = 'nowrap';
        detailsSpan.style.overflow = 'hidden';
        detailsSpan.style.textOverflow = 'ellipsis';
        if (detailsText) label.title = detailsText;

        label.appendChild(usernameSpan);
        if (detailsText) label.appendChild(detailsSpan);
        
        itemDiv.appendChild(checkbox);
        itemDiv.appendChild(icon);
        itemDiv.appendChild(label);
        return itemDiv;
    }

    function renderAllPaginationControls(totalItems, currentPage) {
        if (!allPanePaginationContainer) return;
        allPanePaginationContainer.innerHTML = ''; 
        const totalPages = Math.ceil(totalItems / ALL_SOCIALS_ROWS_PER_PAGE);
        allPanePaginationContainer.dataset.totalPages = totalPages;
        if (totalPages <= 1) return; 

        const prevButton = document.createElement('button');
        prevButton.innerHTML = '&laquo; 上一页';
        prevButton.disabled = currentPage === 1;
        prevButton.dataset.action = 'prev';

        const pageInfo = document.createElement('span');
        pageInfo.className = 'page-info';
        pageInfo.textContent = `第 ${currentPage} / ${totalPages} 页`;

        const nextButton = document.createElement('button');
        nextButton.innerHTML = '下一页 &raquo;';
        nextButton.disabled = currentPage === totalPages;
        nextButton.dataset.action = 'next';

        allPanePaginationContainer.appendChild(prevButton);
        allPanePaginationContainer.appendChild(pageInfo);
        allPanePaginationContainer.appendChild(nextButton);
    }
    
    function renderAllSocialsPaneContent(socialsToRender, page) {
        console.log(`[Link Modal] renderAllSocialsPaneContent called. Rendering Page: ${page}, Total Items to Render: ${socialsToRender?.length ?? 'N/A'}`);
        const allPane = tabContentContainer.querySelector('#pane-all');
        if (!allPane) {
            console.error('[Link Modal] Error: #pane-all not found during render!');
            return;
        }
        
        allPane.querySelectorAll('.social-link-item, .no-search-result').forEach(el => el.remove());
        const paginationContainer = allPane.querySelector('.all-pane-pagination');

        const startIndex = (page - 1) * ALL_SOCIALS_ROWS_PER_PAGE;
        const endIndex = startIndex + ALL_SOCIALS_ROWS_PER_PAGE;
        const pageItems = socialsToRender.slice(startIndex, endIndex); 
        console.log(`[Link Modal] Sliced items for page ${page} (Indices ${startIndex}-${endIndex-1}): Count = ${pageItems.length}`);

        if (pageItems.length === 0 && socialsToRender.length > 0) {
             console.warn("[Link Modal] Rendered page has no items, but total list is not empty.");
        }

        pageItems.forEach((social, index) => {
            try {
                const itemElement = createSocialItemElement(social);
                if (paginationContainer) {
                    allPane.insertBefore(itemElement, paginationContainer); 
                } else {
                    allPane.appendChild(itemElement);
                }
            } catch (error) {
                console.error(`[Link Modal] Error creating/inserting item ${index} for page ${page}:`, error, social);
            }
        });
        
        console.log(`[Link Modal] Finished rendering items for page ${page}. Rendering pagination...`);
        renderAllPaginationControls(socialsToRender.length, page);
        
        let noResultMessage = allPane.querySelector('.no-search-result');
        const searchTerm = searchInput.value.toLowerCase().trim();
        if (socialsToRender.length === 0 && searchTerm) {
            if (!noResultMessage) {
                noResultMessage = document.createElement('p');
                noResultMessage.className = 'text-muted text-center no-search-result';
                noResultMessage.textContent = '没有匹配的账户。';
                allPane.insertBefore(noResultMessage, allPanePaginationContainer);
            }
             noResultMessage.style.display = 'block';
         } else if (noResultMessage) {
             noResultMessage.style.display = 'none';
         }
    }

    function renderLinkedPaginationControls(totalItems, currentPage) {
        const linkedPaginationContainer = tabContentContainer.querySelector('#pane-linked .linked-pane-pagination');
        if (!linkedPaginationContainer) return;
        linkedPaginationContainer.innerHTML = ''; 
        const totalPages = Math.ceil(totalItems / LINKED_SOCIALS_ROWS_PER_PAGE);
        linkedPaginationContainer.dataset.totalPages = totalPages;
        if (totalPages <= 1) return; 

        const prevButton = document.createElement('button');
        prevButton.disabled = currentPage === 1;
        prevButton.dataset.action = 'prev';

        const pageInfo = document.createElement('span');
        pageInfo.className = 'page-info';
        pageInfo.textContent = `第 ${currentPage} / ${totalPages} 页`;

        const nextButton = document.createElement('button');
        nextButton.disabled = currentPage === totalPages;
        nextButton.dataset.action = 'next';

        linkedPaginationContainer.appendChild(prevButton);
        linkedPaginationContainer.appendChild(pageInfo);
        linkedPaginationContainer.appendChild(nextButton);
    }

    function renderLinkedSocialsPaneContent(socialsToRender, page) {
        const linkedPane = tabContentContainer.querySelector('#pane-linked');
        if (!linkedPane) return;
        
        linkedPane.querySelectorAll('.social-link-item, .no-search-result').forEach(el => el.remove());
        const paginationContainer = linkedPane.querySelector('.linked-pane-pagination');

        const startIndex = (page - 1) * LINKED_SOCIALS_ROWS_PER_PAGE;
        const endIndex = startIndex + LINKED_SOCIALS_ROWS_PER_PAGE;
        const pageItems = socialsToRender.slice(startIndex, endIndex);

        if (pageItems.length === 0) {
            const searchTerm = searchInput.value.toLowerCase().trim();
            const emptyMessage = document.createElement('p');
            emptyMessage.className = 'text-muted text-center no-search-result';
            emptyMessage.textContent = searchTerm ? '没有匹配的账户。' : '当前没有已关联的账户。';
             if (paginationContainer) linkedPane.insertBefore(emptyMessage, paginationContainer);
             else linkedPane.appendChild(emptyMessage);
        }

        pageItems.forEach(social => {
             if (paginationContainer) linkedPane.insertBefore(createSocialItemElement(social), paginationContainer);
             else linkedPane.appendChild(createSocialItemElement(social));
        });

        renderLinkedPaginationControls(socialsToRender.length, page);
        if (paginationContainer) paginationContainer.style.display = socialsToRender.length > LINKED_SOCIALS_ROWS_PER_PAGE ? 'flex' : 'none';
    }

    if (allPanePaginationContainer) { 
        allPanePaginationContainer.addEventListener('click', (event) => {
            const button = event.target.closest('button[data-action]');
            if (!button || button.disabled) return; 
            const action = button.dataset.action;
            const totalPages = parseInt(allPanePaginationContainer.dataset.totalPages || '1');

            let newPage = allSocialsCurrentPage;
            if (action === 'prev' && allSocialsCurrentPage > 1) {
                newPage--;
            } else if (action === 'next' && allSocialsCurrentPage < totalPages) {
                newPage++;
            }

            if (newPage !== allSocialsCurrentPage) {
                allSocialsCurrentPage = newPage;
                const searchTerm = searchInput.value.toLowerCase().trim();
                const currentlyFilteredData = allSocialsData.filter(social => {
                    const content = `${social.platform} ${social.identifier} ${social.binding || ''} ${social.notes || ''}`.toLowerCase();
                    return !searchTerm || content.includes(searchTerm);
                });
                renderAllSocialsPaneContent(currentlyFilteredData, allSocialsCurrentPage);
            }
        });
    } else {
        console.error('[Link Modal] Error: allPanePaginationContainer not found!');
    }
    
    const linkedPaginationContainer = tabContentContainer.querySelector('#pane-linked .linked-pane-pagination');
     if (linkedPaginationContainer) { 
         linkedPaginationContainer.addEventListener('click', (event) => {
             const button = event.target.closest('button[data-action]');
             if (!button || button.disabled) return; 
             const action = button.dataset.action;
             const totalPages = parseInt(linkedPaginationContainer.dataset.totalPages || '1');
             
             let newPage = allSocialsCurrentPage;
             if (action === 'prev' && allSocialsCurrentPage > 1) {
                 newPage--;
             } else if (action === 'next' && allSocialsCurrentPage < totalPages) {
                 newPage++;
             }

             if (newPage !== allSocialsCurrentPage) {
                 allSocialsCurrentPage = newPage;
                 const searchTerm = searchInput.value.toLowerCase().trim();
                 const currentlyFilteredLinkedData = allSocialsData.filter(social => 
                     selectedSocialIdsSet.has(social.id) && 
                     (!searchTerm || `${social.platform} ${social.identifier} ${social.binding || ''} ${social.notes || ''}`.toLowerCase().includes(searchTerm))
                 );
                 renderLinkedSocialsPaneContent(currentlyFilteredLinkedData, allSocialsCurrentPage);
             }
         });
     }

    const filterSocials = debounce(() => {
        const searchTerm = searchInput.value.toLowerCase().trim();
        const activeTabButton = tabsContainer.querySelector('.tab-link.active');
        const activeTab = activeTabButton ? activeTabButton.dataset.tab : 'all';
        console.log(`[Link Modal] filterSocials triggered. Tab: ${activeTab}, Term: "${searchTerm}"`);

        if (activeTab === 'all') {
            const newlyFilteredData = allSocialsData.filter(social => {
                const content = `${social.platform} ${social.identifier} ${social.binding || ''} ${social.notes || ''}`.toLowerCase();
                return !searchTerm || content.includes(searchTerm);
            });
            allSocialsCurrentPage = 1;
            renderAllSocialsPaneContent(newlyFilteredData, allSocialsCurrentPage);
        } else if (activeTab === 'linked') {
            const newlyFilteredLinkedData = allSocialsData.filter(social =>
                selectedSocialIdsSet.has(social.id) &&
                (!searchTerm || `${social.platform} ${social.identifier} ${social.binding || ''} ${social.notes || ''}`.toLowerCase().includes(searchTerm))
            );
            let linkedSocialsCurrentPage = 1;
            renderLinkedSocialsPaneContent(newlyFilteredLinkedData, linkedSocialsCurrentPage);
        }
    }, 250);
    searchInput.addEventListener('input', filterSocials);

    try {
        allSocialsData = await window.dbAPI.getAllSocialsWithLinkStatus(walletId);
        selectedSocialIdsSet = new Set(allSocialsData.filter(s => s.isLinked).map(s => s.id));
        if(initialLoadingMessage) initialLoadingMessage.remove();
        if (!allSocialsData || allSocialsData.length === 0) {
             const allPane = tabContentContainer.querySelector('#pane-all');
             if (allPane) allPane.innerHTML = '<p class="text-muted text-center">没有可用的社交账户。</p>';
             if (!tabContentContainer.querySelector('#pane-linked')) {
                 const linkedPane = document.createElement('div');
                 linkedPane.id = 'pane-linked';
                 linkedPane.className = 'tab-pane';
                 linkedPane.innerHTML = '<p class="text-muted text-center">没有可用的社交账户。</p>';
                 const linkedPaginationContainer = document.createElement('div');
                 linkedPaginationContainer.className = 'pagination-controls linked-pane-pagination';
                 linkedPaginationContainer.style.display = 'none';
                 linkedPane.appendChild(linkedPaginationContainer);
                 tabContentContainer.appendChild(linkedPane);
                 console.log('[Link Modal] Created #pane-linked because no data was found.');
             }
        }

        if (!tabContentContainer.querySelector('#pane-linked')) {
            const linkedPane = document.createElement('div');
            linkedPane.id = 'pane-linked';
            linkedPane.className = 'tab-pane';
            const linkedPaginationContainer = document.createElement('div');
            linkedPaginationContainer.className = 'pagination-controls linked-pane-pagination';
            linkedPaginationContainer.style.display = 'none';
            linkedPane.appendChild(linkedPaginationContainer);
            tabContentContainer.appendChild(linkedPane);
            console.log('[Link Modal] Ensured #pane-linked structure exists before adding listeners.');
        } else {
             console.log('[Link Modal] #pane-linked already exists.');
        }

        tabsContainer.addEventListener('click', (e) => {
            if (e.target.matches('.tab-link')) {
                const targetTab = e.target.dataset.tab;
                console.log(`[Link Modal Tab] Clicked tab: ${targetTab}`);

                tabsContainer.querySelectorAll('.tab-link').forEach(tab => tab.classList.remove('active'));
                tabContentContainer.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('active'));
                
                e.target.classList.add('active');
                console.log(`[Link Modal Tab] Activated tab button:`, e.target);

                const targetPaneId = `pane-${targetTab}`;
                const targetPane = tabContentContainer.querySelector(`#${targetPaneId}`);
                if (targetPane) {
                    targetPane.classList.add('active');
                    console.log(`[Link Modal Tab] Activated pane:`, targetPane);
                } else {
                    console.error(`[Link Modal Tab] Error: Could not find pane with ID: ${targetPaneId}`);
                }
                
                searchInput.value = '';

                if (allSocialsData && allSocialsData.length > 0) { 
                    if (targetTab === 'all') {
                        console.log(`[Link Modal Tab] Rendering 'all' tab`);
                        allSocialsCurrentPage = 1;
                        renderAllSocialsPaneContent(allSocialsData, allSocialsCurrentPage);
                    } else if (targetTab === 'linked') {
                        console.log(`[Link Modal Tab] Rendering 'linked' tab`);
                        const linkedSocials = allSocialsData.filter(social => selectedSocialIdsSet.has(social.id));
                        let linkedSocialsCurrentPage = 1;
                        renderLinkedSocialsPaneContent(linkedSocials, linkedSocialsCurrentPage);
                    }
                } else {
                     console.log(`[Link Modal Tab] No data to render for tab ${targetTab}`);
                }
            }
        });

        if (allSocialsData && allSocialsData.length > 0) {
             renderAllSocialsPaneContent(allSocialsData, 1);
             tabsContainer.querySelector('.tab-link[data-tab="all"]').classList.add('active');
             tabContentContainer.querySelector('#pane-all').classList.add('active');
         } else {
             tabsContainer.querySelector('.tab-link[data-tab="all"]').classList.add('active');
             const allPane = tabContentContainer.querySelector('#pane-all');
             if (allPane) allPane.classList.add('active');
         }

        const linkedPaginationContainer = tabContentContainer.querySelector('#pane-linked .linked-pane-pagination');
        if (!linkedPaginationContainer) {
             console.warn('[Link Modal] Could not find .linked-pane-pagination to attach listener after #pane-linked check.');
        }

        searchInput.addEventListener('input', filterSocials);

        saveButton.addEventListener('click', async () => {
            saveButton.disabled = true; saveButton.textContent = '保存中...';
            const linkedIds = Array.from(selectedSocialIdsSet);
            try {
                await window.dbAPI.updateWalletSocialLinks(walletId, linkedIds);
                showToast('关联关系已更新', 'success');
                await loadAndRenderWallets();
                closeModal();
            } catch (error) {
                console.error('更新关联失败:', error);
                showToast(`更新关联失败: ${error.message}`, 'error');
                saveButton.disabled = false; saveButton.textContent = '保存关联';
            }
        });

    } catch (error) {
        console.error('加载社交账户模态框失败:', error);
        tabContentContainer.innerHTML = `<p class="text-error">加载失败: ${error.message}</p>`;
        saveButton.style.display = 'none';
    }
} 