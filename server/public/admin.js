// --- DOM Elements ---
const addTutorialBtn = document.getElementById('add-tutorial-btn');
const tutorialListDiv = document.getElementById('existing-tutorials-list');
const searchInput = document.getElementById('search-input');
const modal = document.getElementById('tutorial-modal');
const modalTitle = document.getElementById('modal-title');
const modalForm = document.getElementById('tutorial-form');
const modalSubmitBtn = document.getElementById('modal-submit-btn');
const closeModalBtn = document.getElementById('close-modal-btn');
const modalCancelBtn = document.getElementById('modal-cancel-btn');
const editIdInput = document.getElementById('edit-id'); // Hidden input in modal
const toastMessage = document.getElementById('toast-message');
const paginationControlsDiv = document.getElementById('pagination-controls'); // 获取分页容器

let allTutorials = []; // 这个变量现在不再需要存储所有数据
let currentPage = 1;
const itemsPerPage = 5; // 每页显示多少条，可以按需调整
let currentSearchTerm = ''; // 存储当前搜索词，以便分页时保持搜索状态
let toastTimeout = null; // For clearing toast message timeout

// --- Toast Message Function ---
function showToast(message, type = 'info') {
    toastMessage.textContent = message;
    toastMessage.className = `show ${type}`; // Add type class (success, error)
    
    // Clear previous timeout if exists
    if (toastTimeout) {
        clearTimeout(toastTimeout);
    }

    // Auto-hide after 3 seconds
    toastTimeout = setTimeout(() => {
        toastMessage.className = toastMessage.className.replace('show', '');
        toastTimeout = null;
    }, 3000);
}

// --- Modal Control Functions ---
function openModal(mode = 'add', tutorial = null) {
    modalForm.reset(); // Clear form fields
    editIdInput.value = ''; // Clear hidden edit ID

    if (mode === 'add') {
        modalTitle.textContent = '新增教程';
        modalSubmitBtn.textContent = '添加教程';
        modalSubmitBtn.className = 'button'; // Default style
    } else if (mode === 'edit' && tutorial) {
        modalTitle.textContent = `编辑教程 (ID: ${tutorial.id})`;
        modalSubmitBtn.textContent = '更新教程';
        modalSubmitBtn.className = 'button update-btn'; // Update style
        
        // Populate form
        editIdInput.value = tutorial.id;
        modalForm.elements['title'].value = tutorial.title;
        modalForm.elements['category'].value = tutorial.category;
        modalForm.elements['description'].value = tutorial.description;
        modalForm.elements['url'].value = tutorial.url;
        modalForm.elements['imageUrl'].value = tutorial.imageUrl || ''; // 添加对imageUrl字段的支持
    }
    modal.classList.add('show');
}

function closeModal() {
    modal.classList.remove('show');
    // Optional: Add a slight delay before resetting form if needed for animation
    // setTimeout(() => { modalForm.reset(); }, 300); 
}

// --- Data Fetching and Rendering (包含分页) ---
async function fetchAndRenderTutorials(page = 1, limit = itemsPerPage, searchTerm = currentSearchTerm) {
    console.log(`Fetching tutorials: page ${page}, limit ${limit}, search '${searchTerm}'`);
    tutorialListDiv.innerHTML = '<p>正在加载教程列表...</p>';
    paginationControlsDiv.innerHTML = ''; // 清空旧的分页控件
    currentPage = page; // 更新当前页码
    currentSearchTerm = searchTerm; // 更新当前搜索词

    // 构建 API URL
    const apiUrl = `/api/tutorials?page=${page}&limit=${limit}&search=${encodeURIComponent(searchTerm)}`;

    try {
        const response = await fetch(apiUrl);
        if (!response.ok) {
            throw new Error(`获取教程列表失败: ${response.statusText}`);
        }
        const result = await response.json(); // API 现在返回 { tutorials, totalPages, ... }
        
        renderTutorialsAdminList(result.tutorials);
        renderPaginationControls(result.totalPages, result.currentPage);

    } catch (error) {
        console.error("获取教程列表错误:", error);
        tutorialListDiv.innerHTML = `<p class="error">无法加载教程列表: ${error.message}</p>`;
    }
}

function renderTutorialsAdminList(tutorials) {
    tutorialListDiv.innerHTML = ''; // Clear list
    if (!tutorials || tutorials.length === 0) {
        if (currentSearchTerm) {
             tutorialListDiv.innerHTML = '<p>没有找到匹配的教程。</p>';
        } else {
             tutorialListDiv.innerHTML = '<p>暂无教程。</p>';
        }
        return;
    }

    const listElement = document.createElement('ul');
    tutorials.forEach(tutorial => {
        const listItem = document.createElement('li');
        listItem.dataset.tutorialId = tutorial.id;

        const detailsDiv = document.createElement('div');
        detailsDiv.className = 'tutorial-details';
        detailsDiv.innerHTML = `
            <strong>${tutorial.title}</strong> (ID: ${tutorial.id})<br>
            <small>分类: ${tutorial.category}</small>
            <small class="desc">描述: ${tutorial.description.substring(0, 80)}${tutorial.description.length > 80 ? '...' : ''}</small>
            <small class="url">URL: ${tutorial.url ? `<a href="${tutorial.url}" target="_blank">${tutorial.url}</a>` : '无'}</small>
            <small class="img-url">图片URL: ${tutorial.imageUrl ? `<a href="${tutorial.imageUrl}" target="_blank">${tutorial.imageUrl}</a>` : '默认图片'}</small>
        `;

        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'tutorial-actions';

        const editButton = document.createElement('button');
        editButton.textContent = '修改';
        editButton.className = 'button edit-btn';
        editButton.onclick = () => openModal('edit', tutorial);

        const deleteButton = document.createElement('button');
        deleteButton.textContent = '删除';
        deleteButton.className = 'button delete-btn';
        deleteButton.onclick = () => handleDeleteTutorial(tutorial.id);

        actionsDiv.appendChild(editButton);
        actionsDiv.appendChild(deleteButton);

        listItem.appendChild(detailsDiv);
        listItem.appendChild(actionsDiv);
        listElement.appendChild(listItem);
    });
    tutorialListDiv.appendChild(listElement);
}

// --- Pagination Control Rendering ---
function renderPaginationControls(totalPages, currentPage) {
    paginationControlsDiv.innerHTML = ''; // Clear existing controls
    if (totalPages <= 1) return; // Don't show controls if only one page

    const createPageButton = (page, text, isDisabled = false, isActive = false) => {
        const button = document.createElement('button');
        button.textContent = text;
        button.className = 'button pagination-btn';
        button.disabled = isDisabled;
        if (isActive) {
            button.classList.add('active');
            button.style.backgroundColor = '#0056b3'; // Active page style
            button.style.cursor = 'default';
        }
        button.onclick = () => fetchAndRenderTutorials(page);
        return button;
    };

    // Previous Button
    paginationControlsDiv.appendChild(
        createPageButton(currentPage - 1, '上一页', currentPage === 1)
    );

    // Page Number Buttons (simple version: show all page numbers)
    // For many pages, you'd implement logic to show only a range (e.g., first, last, current +/- 2)
    for (let i = 1; i <= totalPages; i++) {
        paginationControlsDiv.appendChild(
            createPageButton(i, i, false, i === currentPage)
        );
    }

    // Next Button
    paginationControlsDiv.appendChild(
        createPageButton(currentPage + 1, '下一页', currentPage === totalPages)
    );
}

// --- Form Submission (Modal) ---
modalForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const formData = new FormData(modalForm);
    const tutorialData = {};
    formData.forEach((value, key) => {
        if (key !== 'editId') {
            tutorialData[key] = value;
        }
    });

    const currentEditId = editIdInput.value;
    const isEditing = !!currentEditId;
    const apiUrl = isEditing ? `/api/tutorials/${currentEditId}` : '/api/tutorials';
    const method = isEditing ? 'PUT' : 'POST';
    const actionText = isEditing ? '更新' : '添加';

    console.log(`准备${actionText}数据 (${method}):`, tutorialData);
    modalSubmitBtn.disabled = true; 

    try {
        const response = await fetch(apiUrl, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(tutorialData),
        });
        const result = await response.json();
        if (response.ok) {
            showToast(`教程${actionText}成功!`, 'success');
            closeModal();
            // 刷新时回到第一页还是当前页？通常回到第一页，或者根据操作决定
            // 这里我们刷新当前页，但如果是新增，回到第一页可能更好
            fetchAndRenderTutorials(isEditing ? currentPage : 1); 
        } else {
            showToast(`${actionText}失败: ${result.error || response.statusText}`, 'error');
            console.error(`${actionText}失败:`, result);
        }
    } catch (error) {
        showToast(`${actionText}请求失败，请检查网络或服务器状态。`, 'error');
        console.error(`${actionText}请求错误:`, error);
    } finally {
         modalSubmitBtn.disabled = false; 
    }
});

// --- Delete Handler ---
async function handleDeleteTutorial(id) {
    if (!confirm(`确定要删除教程 ID 为 "${id}" 的教程吗？`)) {
        return;
    }
    console.log(`请求删除教程: ${id}`);
    try {
        const response = await fetch(`/api/tutorials/${id}`, {
            method: 'DELETE',
        });
        const result = await response.json(); 
        if (response.ok) {
            showToast(result.message || '删除成功!', 'success');
            // 删除后刷新当前页
            fetchAndRenderTutorials(currentPage); 
        } else {
            showToast(`删除失败: ${result.error || response.statusText}`, 'error');
            console.error('删除失败:', result);
        }
    } catch (error) {
        showToast('删除请求失败，请检查网络或服务器状态。', 'error');
        console.error('删除请求错误:', error);
    }
}

// --- Event Listeners ---
// Open modal for adding
addTutorialBtn.addEventListener('click', () => openModal('add'));

// Close modal
closeModalBtn.addEventListener('click', closeModal);
modalCancelBtn.addEventListener('click', closeModal);
// Optional: Close modal if clicking outside the content
modal.addEventListener('click', (event) => {
    if (event.target === modal) { // Check if the click was directly on the overlay
        closeModal();
    }
});

// Search input handler (fetch on input change, reset to page 1)
searchInput.addEventListener('input', (event) => {
    // 使用 debounce 优化会更好，这里简单实现
    fetchAndRenderTutorials(1, itemsPerPage, event.target.value); 
});

// --- Initial Load ---
document.addEventListener('DOMContentLoaded', () => fetchAndRenderTutorials()); 