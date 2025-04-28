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

let allTutorials = []; // Store all fetched tutorials for filtering
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
    }
    modal.classList.add('show');
}

function closeModal() {
    modal.classList.remove('show');
    // Optional: Add a slight delay before resetting form if needed for animation
    // setTimeout(() => { modalForm.reset(); }, 300); 
}

// --- Data Fetching and Rendering ---
async function fetchAndRenderTutorials(searchTerm = '') {
    console.log("Fetching existing tutorials...");
    tutorialListDiv.innerHTML = '<p>正在加载教程列表...</p>';
    try {
        const response = await fetch('/api/tutorials');
        if (!response.ok) {
            throw new Error(`获取教程列表失败: ${response.statusText}`);
        }
        allTutorials = await response.json(); // Store all data
        filterAndRenderList(searchTerm);
    } catch (error) {
        console.error("获取教程列表错误:", error);
        tutorialListDiv.innerHTML = `<p class="error">无法加载教程列表: ${error.message}</p>`;
        allTutorials = []; // Reset data on error
    }
}

function filterAndRenderList(searchTerm) {
    const lowerCaseSearchTerm = searchTerm.toLowerCase().trim();
    const filteredTutorials = allTutorials.filter(tutorial => {
        return (
            tutorial.title.toLowerCase().includes(lowerCaseSearchTerm) ||
            tutorial.description.toLowerCase().includes(lowerCaseSearchTerm) ||
            tutorial.id.toLowerCase().includes(lowerCaseSearchTerm)
        );
    });
    renderTutorialsAdminList(filteredTutorials);
}

function renderTutorialsAdminList(tutorials) {
    tutorialListDiv.innerHTML = ''; // Clear list
    if (!tutorials || tutorials.length === 0) {
        tutorialListDiv.innerHTML = '<p>没有找到匹配的教程。</p>';
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

// --- Form Submission (Modal) ---
modalForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const formData = new FormData(modalForm);
    const tutorialData = {};
    formData.forEach((value, key) => {
        // Don't include the hidden editId field in the actual data sent
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
    modalSubmitBtn.disabled = true; // Disable button during request

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
            fetchAndRenderTutorials(searchInput.value); // Refresh list with current search term
        } else {
            showToast(`${actionText}失败: ${result.error || response.statusText}`, 'error');
            console.error(`${actionText}失败:`, result);
        }
    } catch (error) {
        showToast(`${actionText}请求失败，请检查网络或服务器状态。`, 'error');
        console.error(`${actionText}请求错误:`, error);
    } finally {
         modalSubmitBtn.disabled = false; // Re-enable button
    }
});

// --- Delete Handler (remains mostly the same, uses toast) ---
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
            fetchAndRenderTutorials(searchInput.value); // Refresh list
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

// Search input handler
searchInput.addEventListener('input', (event) => {
    filterAndRenderList(event.target.value);
});

// --- Initial Load ---
document.addEventListener('DOMContentLoaded', () => fetchAndRenderTutorials()); 