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
        patientLists: {}, // Keyed by DOS, e.g., { '2023-10-27': [...] }
        reasonTags: new Set(),
        resultsNeededTags: new Set(),
        visitTypeTags: new Set(),
        columnOrder: [], 
        fileToProcess: null
    };
    const LOCAL_STORAGE_KEY = 'clinicalTaskListData';

    // --- Utility & Helper Functions ---
    const showNotification = (message, type = 'info') => {
        try {
            const colors = {
                success: 'bg-green-500',
                error: 'bg-red-500',
                info: 'bg-blue-500'
            };
            const notif = document.createElement('div');
            notif.className = `text-white px-6 py-4 border-0 rounded-lg relative mb-4 shadow-lg ${colors[type]}`;
            notif.innerHTML = `<span class="inline-block align-middle mr-8">${message}</span><button class="absolute bg-transparent text-2xl font-semibold leading-none right-0 top-0 mt-4 mr-6 outline-none focus:outline-none" onclick="this.parentElement.remove()"><span>×</span></button>`;
            notificationContainer.appendChild(notif);
            setTimeout(() => { notif.remove(); }, 5000);
        } catch (e) {
            console.error("Failed to show notification:", e, message);
        }
    };

    const saveData = () => {
        try {
            const dataToSave = {
                ...appState,
                reasonTags: Array.from(appState.reasonTags),
                resultsNeededTags: Array.from(appState.resultsNeededTags),
                visitTypeTags: Array.from(appState.visitTypeTags)
            };
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(dataToSave));
        } catch (e) {
            console.error("Error saving to localStorage:", e);
            showNotification('Error: Could not save data. Storage may be full.', 'error');
        }
    };

    const loadData = () => {
        const savedData = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (savedData) {
            try {
                const parsedData = JSON.parse(savedData);
                appState.patientLists = parsedData.patientLists || {};
                Object.values(appState.patientLists).forEach(list => {
                    list.forEach(patient => {
                        delete patient['Provider'];
                        delete patient['Appt Time'];
                        if (Array.isArray(patient['Visit Type'])) {
                            patient['Visit Type'] = patient['Visit Type'][0] || '';
                        }
                        // Initialize new fields if they don't exist
                        if (!patient.hasOwnProperty('Chart')) patient['Chart'] = null;
                        if (!patient.hasOwnProperty('Extracted Summary')) patient['Extracted Summary'] = null;
                    });
                });
                
                appState.reasonTags = new Set(parsedData.reasonTags || []);
                appState.resultsNeededTags = new Set(parsedData.resultsNeededTags || []);
                appState.visitTypeTags = new Set(parsedData.visitTypeTags || []);
                appState.columnOrder = (parsedData.columnOrder || []).filter(col => col !== 'Provider' && col !== 'Appt Time');
                renderApp();
            } catch (e) {
                console.error("Error parsing saved data:", e);
                showNotification('Error loading data. Local storage was corrupt and has been cleared.', 'error');
                localStorage.removeItem(LOCAL_STORAGE_KEY); // Clear corrupt data
            }
        }
    };

    const normalizeName = (name) => {
        if (typeof name !== 'string' || !name) return '';
        const upperName = name.toUpperCase();
        const parts = upperName.split(',');
        if (parts.length < 2) return upperName.replace(/ /g, '');
        const lastName = parts[0].trim();
        const firstNamePart = parts[1].trim();
        const firstName = firstNamePart.split(' ')[0];
        return `${lastName},${firstName}`;
    };

    // --- Data Formatting Functions ---
    const formatTime = (time) => time && typeof time === 'string' ? time.replace(/^0/, '') : time;
    const formatSex = (sex) => sex && typeof sex === 'string' ? sex.charAt(0).toUpperCase() : sex;
    const formatAge = (age) => age && typeof age === 'string' ? age.replace(/ Y$/, '') : age;
    const formatDOB = (dob) => {
         if (!dob) return '';
        if (typeof dob === 'number') {
            const date = new Date(Math.round((dob - 25569) * 86400 * 1000));
            return `${String(date.getUTCMonth() + 1).padStart(2, '0')}/${String(date.getUTCDate()).padStart(2, '0')}/${date.getUTCFullYear()}`;
        }
        try {
            const date = new Date(dob);
            if (isNaN(date)) return dob;
            return `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}/${date.getFullYear()}`;
        } catch (e) { return dob; }
    };
    const formatPhone = (phone) => {
        if (!phone) return phone;
        const cleaned = ('' + phone).replace(/\D/g, '');
        const match = cleaned.match(/^(\d{3})(\d{3})(\d{4})$/);
        return match ? `(${match[1]}) ${match[2]}-${match[3]}` : phone;
    };
    
    const timeStringToMinutes = (timeStr) => {
        if (!timeStr || typeof timeStr !== 'string') return 9999;
        const timeParts = timeStr.match(/(\d{1,2}):(\d{2})\s?(AM|PM)/i);
        if (!timeParts) return 9999;
        let [, hour, minute, ampm] = timeParts;
        hour = parseInt(hour, 10);
        minute = parseInt(minute, 10);
        if (ampm.toUpperCase() === 'PM' && hour !== 12) hour += 12;
        if (ampm.toUpperCase() === 'AM' && hour === 12) hour = 0;
        return hour * 60 + minute;
    };

    const isNonStandardTime = (timeStr) => {
        if (!timeStr || typeof timeStr !== 'string') return false;
        const timeParts = timeStr.match(/(\d{1,2}):(\d{2})\s?(AM|PM)/i);
        if (!timeParts) return true;
        let [, hour, minute, ampm] = timeParts;
        hour = parseInt(hour, 10);
        minute = parseInt(minute, 10);
        if (ampm.toUpperCase() === 'PM' && hour !== 12) hour += 12;
        if (ampm.toUpperCase() === 'AM' && hour === 12) hour = 0;
        if (hour < 8 || hour >= 15) return true;
        if (![0, 20, 40].includes(minute)) return true;
        return false;
    };

    const generateStandardTimeSlots = () => {
        const slots = [];
        for (let hour = 8; hour < 15; hour++) {
            for (let minute of [0, 20, 40]) {
                 if (hour === 15 && minute > 0) continue;
                const d = new Date(2000, 0, 1, hour, minute);
                slots.push(d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).replace(/^0/, ''));
            }
        }
         if (slots.includes("3:00 PM")) slots.pop();
        return slots;
    };

    // --- Core Application Logic ---
    const handleFile = (file) => {
        try {
            const fileName = file.name.toLowerCase();
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array', cellDates: true });
                    const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: "" });
                    if (jsonData.length === 0) { showNotification('File is empty.', 'error'); return; }
                    if (fileName.includes('ovenctrs')) {
                        appState.fileToProcess = jsonData;
                        dosInput.value = '';
                        dosModal.classList.remove('hidden');
                    } else if (fileName.includes('registry_report') || fileName.includes('cwreport')) {
                        processSupplementalData(jsonData);
                    } else { showNotification(`Unrecognized file: "${file.name}".`, 'error'); }
                } catch (readError) {
                    console.error("Error reading workbook:", readError);
                    showNotification(`Error processing file: ${file.name}. It may be corrupt or in an unsupported format.`, 'error');
                }
            };
            reader.onerror = () => showNotification(`Error reading file "${file.name}".`, 'error');
            reader.readAsArrayBuffer(file);
        } catch (fileError) {
            console.error("Error in handleFile:", fileError);
            showNotification('An unexpected error occurred while handling the file.', 'error');
        }
    };

    const processPrimaryData = (data, dos) => {
        if (!data || data.length === 0) return;
        try {
            const visitStsIndex = Object.keys(data[0]).indexOf('Visit Sts');
            const columnsToRemove = visitStsIndex !== -1 ? Object.keys(data[0]).slice(visitStsIndex) : [];
            columnsToRemove.push('P/R', 'Provider', 'Appt Time');
            const processedList = data.map((row, index) => {
                const newRow = {
                    id: `${dos}-${index}`,
                    'Visit Type': row['Visit Type'] ? String(row['Visit Type']) : '',
                    'Patient Name': row['Patient Name'],
                    'Time': formatTime(row['Appt Time']),
                    'Sex': formatSex(row['Sex']),
                    'Age': formatAge(row['Age']),
                    'Reason': [],
                    'Results Needed': [],
                    'Chart': null,
                    'Extracted Summary': null,
                    'isPrinted': false,
                    'isDone': false,
                    'isCancelled': false,
                };
                const filteredRow = { ...row };
                columnsToRemove.forEach(col => delete filteredRow[col]);
                Object.keys(filteredRow).forEach(key => { if (!(key in newRow)) newRow[key] = filteredRow[key]; });
                return newRow;
            });
            appState.patientLists[dos] = processedList;
            saveData();
            renderApp();
            showNotification(`Processed primary list for ${dos}.`, 'success');
        } catch (e) {
            console.error("Error processing primary data:", e);
            showNotification('Error processing primary data. Check file columns.', 'error');
            appState.fileToProcess = null; // Clear file in case of error
        }
    };
    
    const processSupplementalData = (data) => {
        try {
            if (Object.keys(appState.patientLists).length === 0) { showNotification('Upload a primary list before supplemental data.', 'error'); return; }
            const firstRow = data[0] || {};
            const sourceHeaders = Object.keys(firstRow);
            const columnMapping = { 'Patient Name': 'Patient Name', 'DOB': 'DOB', 'Tel No.': 'Phone', 'Acc #': 'Account' };
            const foundHeaders = {}, missingColumns = [];
            for (const requiredHeader of Object.keys(columnMapping)) {
                const foundKey = sourceHeaders.find(h => h.trim().toLowerCase() === requiredHeader.toLowerCase());
                if (foundKey) foundHeaders[requiredHeader] = foundKey;
                else missingColumns.push(requiredHeader);
            }
            if (missingColumns.length > 0) { showNotification(`Supplemental file missing: ${missingColumns.join(', ')}.`, 'error'); return; }
            const supplementalMap = new Map();
            data.forEach(row => {
                const normalized = normalizeName(row[foundHeaders['Patient Name']]);
                if (normalized) {
                    supplementalMap.set(normalized, {
                        [columnMapping['DOB']]: formatDOB(row[foundHeaders['DOB']]),
                        [columnMapping['Tel No.']]: formatPhone(row[foundHeaders['Tel No.']]),
                        [columnMapping['Acc #']]: row[foundHeaders['Acc #']],
                    });
                }
            });
            let mergeCount = 0;
            Object.values(appState.patientLists).forEach(list => {
                list.forEach(patient => {
                    const normalized = normalizeName(patient['Patient Name']);
                    if (supplementalMap.has(normalized)) {
                        Object.assign(patient, supplementalMap.get(normalized));
                        mergeCount++;
                    }
                });
            });
            saveData();
            renderApp();
            showNotification(`Merged data for ${mergeCount} patient(s).`, 'success');
        } catch (e) {
            console.error("Error processing supplemental data:", e);
            showNotification('Error processing supplemental data. Check file columns.', 'error');
        }
    };

    const updateDatalist = (id, tags) => {
        let datalist = document.getElementById(id);
        if (!datalist) {
            datalist = document.createElement('datalist');
            datalist.id = id;
            document.body.appendChild(datalist);
        }
        const sortedTags = Array.from(tags).sort();
        datalist.innerHTML = sortedTags.map(tag => `<option value="${tag}"></option>`).join('');
    };

    const createEditableCell = (patient, header) => {
        const cellContent = document.createElement('div');
        cellContent.contentEditable = true;
        cellContent.className = 'outline-none focus:bg-yellow-100 p-1 rounded -m-1'; // Negative margin to fill cell
        cellContent.textContent = patient[header] || '';
        let originalValue = cellContent.textContent;

        cellContent.addEventListener('focus', () => {
            originalValue = cellContent.textContent;
        });

        cellContent.addEventListener('blur', () => {
            const newValue = cellContent.textContent.trim();
            let formattedValue = newValue;
            switch (header) {
                case 'Time': formattedValue = formatTime(newValue); break;
                case 'Phone': formattedValue = formatPhone(newValue); break;
                case 'DOB': formattedValue = formatDOB(newValue); break;
                case 'Sex': formattedValue = formatSex(newValue); break;
                case 'Age': formattedValue = formatAge(newValue); break;
            }
            patient[header] = formattedValue;
            saveData();
            renderApp(); 
        });

        cellContent.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                e.target.blur();
            }
            if (e.key === 'Escape') {
                cellContent.textContent = originalValue;
                e.target.blur();
            }
        });

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
        uploadArea.classList.toggle('hidden', hasData);
        controlsArea.classList.toggle('hidden', !hasData);
        dataDisplayArea.innerHTML = '';
        if (!hasData) return;

        const allKeys = new Set();
        Object.values(appState.patientLists).forEach(list => list.forEach(p => Object.keys(p).forEach(k => allKeys.add(k))));
        const fixedOrder = ['Visit Type', 'Time', 'Patient Name', 'Sex', 'DOB', 'Age', 'Reason', 'Results Needed', 'Chart', 'Extracted Summary'];
        const checkboxColumns = ['Printed', 'Done', 'Cancelled'];
        const internalKeys = ['id', 'isPrinted', 'isDone', 'isCancelled', 'isEmptySlot', 'isDoubleBooked'];
        const otherColumns = Array.from(allKeys).filter(k => 
            !fixedOrder.includes(k) && !checkboxColumns.includes(k) && !internalKeys.includes(k)
        );
        const displayOrder = [...fixedOrder.filter(c => allKeys.has(c) || c === 'Visit Type' || c === 'Chart' || c === 'Extracted Summary'), ...otherColumns, ...checkboxColumns];
        appState.columnOrder = displayOrder;

        updateDatalist('visit-type-datalist', appState.visitTypeTags);
        updateDatalist('reason-datalist', appState.reasonTags);
        updateDatalist('results-needed-datalist', appState.resultsNeededTags);

        const sortedDOSKeys = Object.keys(appState.patientLists).sort((a, b) => new Date(b) - new Date(a));
        sortedDOSKeys.forEach(dos => {
            let patientList = appState.patientLists[dos];
            const timeCounts = {};
            patientList.forEach(p => { timeCounts[p.Time] = (timeCounts[p.Time] || 0) + 1; });
            patientList.forEach(p => { p.isDoubleBooked = timeCounts[p.Time] > 1; });
            const standardSlots = generateStandardTimeSlots();
            const existingTimes = new Set(patientList.map(p => p.Time));
            const emptySlots = standardSlots.filter(slot => !existingTimes.has(slot));
            const placeholderRows = emptySlots.map(time => ({ id: `empty-${dos}-${time}`, Time: time, isEmptySlot: true }));
            let displayList = [...patientList, ...placeholderRows];
            displayList.sort((a, b) => timeStringToMinutes(a.Time) - timeStringToMinutes(b.Time));
            const dosContainer = document.createElement('details');
            dosContainer.className = 'bg-white rounded-lg shadow overflow-hidden';
            dosContainer.open = true;
            const dosHeader = document.createElement('summary');
            dosHeader.className = 'p-4 bg-gray-100 cursor-pointer border-b font-bold text-lg flex justify-between items-center';
            const headerText = document.createElement('span');
            headerText.textContent = `Date of Service: ${new Date(dos + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`;
            const addApptBtn = document.createElement('button');
            addApptBtn.textContent = '+ Add Appointment';
            addApptBtn.className = 'bg-green-500 text-white font-semibold py-1 px-3 rounded-md text-sm hover:bg-green-600 transition-colors shadow-sm';
            addApptBtn.onclick = (e) => {
                e.preventDefault();
                const newPatient = {
                    id: `manual-${dos}-${Date.now()}`, 'Visit Type': '', Time: '', 'Patient Name': '', 
                    Sex: '', Age: '', DOB: '', Phone: '', Account: '', Reason: [], 'Results Needed': [],
                    'Chart': null, 'Extracted Summary': null,
                    isPrinted: false, isDone: false, isCancelled: false,
                };
                appState.patientLists[dos].push(newPatient);
                saveData();
                renderApp();
            };
            dosHeader.appendChild(headerText);
            dosHeader.appendChild(addApptBtn);

            const tableContainer = document.createElement('div');
            tableContainer.className = 'overflow-x-auto';
            const table = document.createElement('table');
            table.className = 'min-w-full divide-y divide-gray-200';
            const thead = document.createElement('thead');
            thead.className = 'bg-gray-50';
            const tr = document.createElement('tr');

            displayOrder.forEach((headerText) => {
                const th = document.createElement('th');
                th.scope = 'col';
                th.className = 'px-2 py-1 text-left text-xs font-medium text-gray-500 uppercase tracking-wider select-none';
                if (headerText === 'Visit Type') {
                    th.style.width = '120px';
                }
                th.textContent = headerText;
                tr.appendChild(th);
            });

            thead.appendChild(tr);
            table.appendChild(thead);
            
            const tbody = document.createElement('tbody');
            tbody.className = 'bg-white divide-y divide-gray-200';
            displayList.forEach(patient => {
                const row = document.createElement('tr');
                row.dataset.id = patient.id;
                const updateRowStyle = () => {
                    row.classList.remove('bg-pink-100', 'bg-green-100', 'bg-yellow-100', 'line-through');
                    if (patient.isCancelled) row.classList.add('bg-pink-100', 'line-through');
                    else if (patient.isDone) row.classList.add('bg-green-100', 'line-through');
                    else if (patient.isPrinted) row.classList.add('bg-yellow-100');
                };
                if (patient.isEmptySlot) {
                    row.classList.add('bg-gray-100');
                    const convertPlaceholderToPatient = (initialPatientName) => {
                         if(patient.isConverted) return; 
                         patient.isConverted = true;
                        const newPatient = {
                            id: `${dos}-${Date.now()}`, Time: patient.Time, 'Visit Type': '',
                            'Patient Name': initialPatientName, Sex: '', Age: '', Reason: [], 'Results Needed': [],
                            'Chart': null, 'Extracted Summary': null,
                            isPrinted: false, isDone: false, isCancelled: false
                        };
                        appState.patientLists[dos].push(newPatient);
                        saveData();
                        renderApp();
                    };
                    displayOrder.forEach(header => {
                        const cell = document.createElement('td');
                        cell.className = 'px-2 py-1 whitespace-nowrap text-sm';
                        if (header === 'Time') {
                            cell.textContent = patient.Time;
                            cell.className += ' text-gray-500 italic';
                        } else if (header === 'Patient Name') {
                            const input = document.createElement('input');
                            input.type = 'text';
                            input.placeholder = 'Enter Patient Name...';
                            input.className = 'w-full bg-gray-50 border-gray-300 rounded p-1 text-sm focus:bg-white focus:ring-1 focus:ring-blue-500 outline-none';
                            input.onblur = (e) => {
                                const newName = e.target.value.trim();
                                if (newName) convertPlaceholderToPatient(newName);
                            };
                            input.onkeydown = (e) => {
                                if (e.key === 'Enter') {
                                    const newName = e.target.value.trim();
                                    if (newName) e.target.blur();
                                }
                            };
                            cell.appendChild(input);
                        }
                        row.appendChild(cell);
                    });
                } else {
                     displayOrder.forEach(header => {
                        const cell = document.createElement('td');
                        cell.className = 'px-2 py-1 whitespace-nowrap text-sm';
                        const checkboxColumnMap = { 'Printed': 'isPrinted', 'Done': 'isDone', 'Cancelled': 'isCancelled' };
                        if (checkboxColumnMap.hasOwnProperty(header)) {
                            const prop = checkboxColumnMap[header];
                            const checkbox = document.createElement('input');
                            checkbox.type = 'checkbox';
                            checkbox.checked = patient[prop];
                            checkbox.className = 'h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500';
                            checkbox.addEventListener('change', (e) => {
                                patient[prop] = e.target.checked;
                                saveData();
                                updateRowStyle();
                            });
                            cell.classList.add('text-center');
                            cell.appendChild(checkbox);
                        } else if (header === 'Visit Type') {
                            cell.appendChild(createSingleSelectCell(patient, 'Visit Type', 'visit-type-datalist', appState.visitTypeTags));
                        } else if (header === 'Reason') {
                            cell.appendChild(createInteractiveCell(patient, 'Reason', 'reason-datalist', appState.reasonTags, 'bg-blue-100 text-blue-800', 'Add reason...'));
                        } else if (header === 'Results Needed') {
                            cell.appendChild(createResultsNeededCell(patient));
                        } else if (header === 'Chart') {
                            cell.appendChild(createAttachmentCell(patient, 'Chart', 'application/pdf', '.pdf'));
                        } else if (header === 'Extracted Summary') {
                            cell.appendChild(createAttachmentCell(patient, 'Extracted Summary', 'application/pdf,text/html', '.pdf,.html'));
                        } else {
                            const editableCell = createEditableCell(patient, header);
                            if (header === 'Time' && (isNonStandardTime(patient[header]) || patient.isDoubleBooked)) {
                                editableCell.classList.add('font-bold', 'text-gray-900');
                            }
                            cell.appendChild(editableCell);
                        }
                        row.appendChild(cell);
                    });
                    updateRowStyle();
                }
                tbody.appendChild(row);
            });
            table.appendChild(tbody);
            tableContainer.appendChild(table);
            dosContainer.appendChild(dosHeader);
            dosContainer.appendChild(tableContainer);
            dataDisplayArea.appendChild(dosContainer);
        });
    };
    
    const createSingleSelectCell = (patient, key, datalistId, tagSet) => {
        if (Array.isArray(patient[key])) {
            patient[key] = patient[key][0] || '';
        }
        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = 'Select or add...';
        input.className = 'w-full bg-transparent outline-none p-1 rounded -m-1 focus:bg-white focus:ring-1 focus:ring-blue-500';
        input.setAttribute('list', datalistId);
        input.value = patient[key] || '';
        input.addEventListener('change', (e) => {
            const newValue = e.target.value.trim();
            patient[key] = newValue;
            if (newValue && !tagSet.has(newValue)) {
                tagSet.add(newValue);
                updateDatalist(datalistId, tagSet);
            }
            saveData();
        });
        return input;
    };
    
    const createInteractiveCell = (patient, key, datalistId, tagSet, tagClasses, placeholder) => {
        const container = document.createElement('div');
        container.className = 'flex flex-wrap gap-1 items-center';
        if (!patient[key]) patient[key] = []; 

        const renderTags = () => {
            container.innerHTML = ''; 
            patient[key].forEach(item => {
                const tag = document.createElement('span');
                tag.className = `reason-tag ${tagClasses} text-xs font-medium px-2.5 py-0.5 rounded-full flex items-center`;
                tag.innerHTML = `${item} <button class="reason-tag-remove ml-1.5 hover:text-red-900">&times;</button>`;
                tag.querySelector('button').onclick = () => {
                    patient[key] = patient[key].filter(i => i !== item);
                    saveData();
                    renderTags();
                };
                container.appendChild(tag);
            });
            container.appendChild(input);
        };

        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = placeholder || 'Add...';
        input.className = 'flex-grow bg-transparent outline-none p-1 min-w-[80px]';
        input.setAttribute('list', datalistId);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && input.value.trim()) {
                e.preventDefault();
                const newItem = input.value.trim();
                if (!patient[key].includes(newItem)) {
                    patient[key].push(newItem);
                }
                if (!tagSet.has(newItem)) {
                    tagSet.add(newItem);
                    updateDatalist(datalistId, tagSet);
                }
                saveData();
                renderTags();
                input.value = '';
            }
        });

        renderTags();
        return container;
    };

    const createResultsNeededCell = (patient) => {
        if (patient['Results Needed'] && patient['Results Needed'].length > 0 && typeof patient['Results Needed'][0] === 'string') {
            patient['Results Needed'] = patient['Results Needed'].map(name => ({ name: name, completed: false }));
        } else if (!patient['Results Needed']) patient['Results Needed'] = [];
        const container = document.createElement('div');
        container.className = 'flex flex-wrap gap-1 items-center';
        const renderTags = () => {
            container.innerHTML = '';
            patient['Results Needed'].forEach(item => {
                const tag = document.createElement('span');
                tag.className = 'reason-tag bg-purple-100 text-purple-800 text-xs font-medium px-2.5 py-0.5 rounded-full flex items-center cursor-pointer';
                tag.textContent = item.name;
                if (item.completed) tag.classList.add('line-through', 'opacity-70');
                tag.addEventListener('click', () => {
                    item.completed = !item.completed;
                    saveData();
                    renderTags();
                });
                const removeBtn = document.createElement('button');
                removeBtn.className = 'reason-tag-remove ml-1.5 text-purple-600 hover:text-purple-900';
                removeBtn.innerHTML = '&times;';
                removeBtn.onclick = (e) => {
                    e.stopPropagation();
                    patient['Results Needed'] = patient['Results Needed'].filter(r => r.name !== item.name);
                    saveData();
                    renderTags();
                };
                tag.appendChild(removeBtn);
                container.appendChild(tag);
            });
            container.appendChild(input);
        };
        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = 'Add test...';
        input.className = 'flex-grow bg-transparent outline-none p-1 min-w-[80px]';
        input.setAttribute('list', 'results-needed-datalist');
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && input.value.trim()) {
                e.preventDefault();
                const newItemName = input.value.trim();
                const exists = patient['Results Needed'].some(item => item.name.toLowerCase() === newItemName.toLowerCase());
                if (!exists) patient['Results Needed'].push({ name: newItemName, completed: false });
                if (!appState.resultsNeededTags.has(newItemName)) {
                    appState.resultsNeededTags.add(newItemName);
                    updateDatalist('results-needed-datalist', appState.resultsNeededTags);
                }
                saveData();
                renderTags();
                input.value = '';
            }
        });
        renderTags();
        return container;
    };

    const createAttachmentCell = (patient, key, acceptMime, acceptExtension) => {
        const cell = document.createElement('div');
        cell.className = 'attachment-cell';
    
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.className = 'hidden';
        fileInput.accept = acceptExtension;
    
        const renderAttachedFile = () => {
            const fileData = patient[key];
            cell.innerHTML = ''; // Clear cell
            cell.classList.add('has-file');
    
            const fileInfo = document.createElement('div');
            fileInfo.className = 'file-info';
    
            // Icon
            const icon = document.createElement('span');
            const isPdf = fileData.name.toLowerCase().endsWith('.pdf');
            const isHtml = fileData.name.toLowerCase().endsWith('.html');
            icon.textContent = isPdf ? '📄' : (isHtml ? '💻' : '📎');
            icon.className = 'text-lg';
            
            // File name (clickable link)
            const fileName = document.createElement('a');
            fileName.className = 'file-name';
            fileName.textContent = fileData.name;
            fileName.title = `Click to open ${fileData.name}`;
            
            fileInfo.appendChild(icon);
            fileInfo.appendChild(fileName);
    
            const removeBtn = document.createElement('button');
            removeBtn.className = 'remove-file-btn';
            removeBtn.innerHTML = '&times;';
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
                // Default fallback
                fileName.href = fileData.dataUrl;
                fileName.target = '_blank';
            }
            // --- End of new click logic ---
        };
    
        const renderEmpty = () => {
            cell.innerHTML = 'Drop file or click';
            cell.classList.remove('has-file');
        };
    
        const handleFileAttachment = (file) => {
            if (!file) return;
            const allowedTypes = acceptMime.split(',');
            if (!allowedTypes.includes(file.type)) {
                showNotification(`Invalid file type. Please upload ${acceptExtension}.`, 'error');
                return;
            }
    
            const reader = new FileReader();
            reader.onload = () => {
                patient[key] = {
                    name: file.name,
                    dataUrl: reader.result,
                };
                saveData();
                renderAttachedFile();
            };
            reader.onerror = () => {
                showNotification('Error reading file.', 'error');
            };
            reader.readAsDataURL(file);
        };
    
        // Click to browse
        cell.onclick = () => {
            if (!patient[key]) {
                fileInput.click();
            }
        };
        fileInput.onchange = (e) => {
            handleFileAttachment(e.target.files[0]);
            fileInput.value = ''; // Reset for next upload
        };
    
        // Drag and drop events
        cell.ondragover = (e) => {
            e.preventDefault();
            if (!patient[key]) {
                cell.classList.add('drag-over');
            }
        };
        cell.ondragenter = (e) => {
            e.preventDefault();
            if (!patient[key]) {
                cell.classList.add('drag-over');
            }
        };
        cell.ondragleave = (e) => {
            e.preventDefault();
            cell.classList.remove('drag-over');
        };
        cell.ondrop = (e) => {
            e.preventDefault();
            cell.classList.remove('drag-over');
            if (!patient[key] && e.dataTransfer.files.length > 0) {
                handleFileAttachment(e.dataTransfer.files[0]);
            }
        };
    
        // Initial render
        if (patient[key] && patient[key].name) {
            renderAttachedFile();
        } else {
            renderEmpty();
        }
    
        // Append hidden file input
        cell.appendChild(fileInput);
        return cell;
    };

    const setupEventListeners = () => {
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            uploadArea.addEventListener(eventName, e => { e.preventDefault(); e.stopPropagation(); }, false);
        });
        ['dragenter', 'dragover'].forEach(eventName => {
            uploadArea.addEventListener(eventName, () => uploadArea.classList.add('bg-gray-100', 'border-blue-500'), false);
        });
        ['dragleave', 'drop'].forEach(eventName => {
            uploadArea.addEventListener(eventName, () => uploadArea.classList.remove('bg-gray-100', 'border-blue-500'), false);
        });
        uploadArea.addEventListener('drop', e => { for (const file of e.dataTransfer.files) handleFile(file); }, false);
        uploadArea.addEventListener('click', () => fileInput.click());
        uploadAnotherBtn.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', e => { for (const file of e.target.files) handleFile(file); fileInput.value = ''; });
        submitDosBtn.addEventListener('click', () => {
            const dos = dosInput.value;
            if (!dos) { showNotification('Please select a Date of Service.', 'error'); return; }
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
        try {
            loadData();
            setupEventListeners();
        } catch (e) {
            console.error("Critical error on initialization:", e);
            showNotification('Application failed to start. Please clear cache or site data.', 'error');
        }
    };
    init();
});

