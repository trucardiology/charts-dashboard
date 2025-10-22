document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Element References ---
    const uploadArea = document.getElementById('upload-area');
    const fileInput = document.getElementById('file-input');
    const controlsArea = document.getElementById('controls-area');
    const uploadAnotherBtn = document.getElementById('upload-another-btn');
    const dataDisplayArea = document.getElementById('data-display-area');
    const dosModal = document.getElementById('dos-modal');
    const dosInput = document.getElementById('dos-input');
    const submitDosBtn = document.getElementById('submit-dos-btn');
    const notificationContainer = document.getElementById('notification-container');
    const pdfModal = document.getElementById('pdf-modal');
    const pdfModalContent = document.getElementById('pdf-modal-content');
    const pdfModalTitle = document.getElementById('pdf-modal-title');
    const pdfModalCloseBtn = document.getElementById('pdf-modal-close-btn');
    const pdfIframe = document.getElementById('pdf-iframe');

    // --- Application State ---
    let appState = {
// ... existing code ... */
        const cellContent = document.createElement('div');
        cellContent.contentEditable = true;
        cellContent.className = 'outline-none focus:bg-yellow-100 p-1 rounded -m-1'; // Negative margin to fill cell
// ... existing code ... */
        return cellContent;
    };

    // --- PDF Modal Functions ---
    const openPdfModal = (dataUrl, fileName) => {
        pdfModalTitle.textContent = fileName || 'PDF Viewer';
        pdfIframe.src = dataUrl;
        pdfModal.classList.remove('hidden');
    };

    const closePdfModal = () => {
        pdfIframe.src = 'about:blank'; // Clear the iframe to stop loading
        pdfModal.classList.add('hidden');
    };

    // --- Rendering Logic ---
    const renderApp = () => {
        const hasData = Object.keys(appState.patientLists).length > 0;
// ... existing code ... */
            const removeBtn = document.createElement('button');
            removeBtn.className = 'remove-file-btn';
            removeBtn.innerHTML = '&times;';
// ... existing code ... */
            removeBtn.title = 'Remove file';
            removeBtn.onclick = (e) => {
                e.stopPropagation();
                patient[key] = null;
                saveData();
                renderEmpty();
            };
    
            cell.appendChild(fileInfo);
            cell.appendChild(removeBtn);

            // --- Apply new click logic based on column and file type ---
            const isPdf = fileData.name.toLowerCase().endsWith('.pdf');
            const isHtml = fileData.name.toLowerCase().endsWith('.html');

            if (key === 'Chart') {
                // Charts are always PDF and open in modal
                fileName.href = '#';
                fileName.onclick = (e) => {
                    e.preventDefault();
                    openPdfModal(fileData.dataUrl, fileData.name);
                };
            } else if (key === 'Extracted Summary') {
                if (isHtml) {
                    // HTML opens in a new tab
                    fileName.href = fileData.dataUrl;
                    fileName.target = '_blank';
                } else if (isPdf) {
                    // PDF opens in a modal
                    fileName.href = '#';
                    fileName.onclick = (e) => {
                        e.preventDefault();
                        openPdfModal(fileData.dataUrl, fileData.name);
                    };
                } else {
                    // Fallback for any other file types (shouldn't happen with validation)
                    fileName.href = fileData.dataUrl;
                    fileName.target = '_blank';
                }
            } else {
                // Default fallback (e.g., if new attachment columns are added later)
                fileName.href = fileData.dataUrl;
                fileName.target = '_blank';
            }
            // --- End of new click logic ---
        };
    
        const renderEmpty = () => {
// ... existing code ... */
            fileInput.value = ''; // Reset for next upload
        };
    
        // Drag and drop events
// ... existing code ... */
        return cell;
    };

    const setupEventListeners = () => {
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
// ... existing code ... */
            dosModal.classList.add('hidden');
            processPrimaryData(appState.fileToProcess, dos);
            appState.fileToProcess = null;
        });

        // PDF Modal close events
        pdfModalCloseBtn.onclick = closePdfModal;
        pdfModal.onclick = (e) => {
            // Close if clicking on the overlay (outside the content)
            if (e.target === pdfModal) {
                closePdfModal();
            }
        };
    };

    const init = () => {
// ... existing code ... */

