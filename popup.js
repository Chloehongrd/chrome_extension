document.addEventListener('DOMContentLoaded', function () {
  // Navigation buttons
  document.getElementById('switch-to-interface-1').addEventListener('click', function () {
    switchInterface('interface-1');
    saveLastOpenedInterface('interface-1');
  });

  document.getElementById('switch-to-interface-2').addEventListener('click', function () {
    switchInterface('interface-2');
    saveLastOpenedInterface('interface-2');
  });

  // Initialize Interface 1
  if (document.getElementById('save-form-1')) {
    document.getElementById('save-form-1').addEventListener('submit', savePage1);
    document.getElementById('export-button-1').addEventListener('click', exportPages1);
    document.getElementById('search-input-1').addEventListener('input', displayGroupsAndPages1);
    updateGroupSelect1();
    displayGroupsAndPages1();
  }

  // Initialize Interface 2
  if (document.getElementById('calendar__month') && document.getElementById('calendar__year')) {
    document.getElementById('calendar__month').addEventListener('change', function() {
      updateCalendar();
      saveCalendarSelection();
    });
    document.getElementById('calendar__year').addEventListener('change', function() {
      updateCalendar();
      saveCalendarSelection();
    });
    document.getElementById('set-daily-goal-button').addEventListener('click', setDailyGoal);
    loadDailyGoal();
    loadCalendarSelection(); // Load the last selected month and year
    updateCalendar(); // Initial load
  }
  
  loadColorScheme();

  // Enable save site by pressing Enter
  document.addEventListener('keypress', function (e) {
    if (e.key === 'Enter') {
      const activeForm = document.querySelector('.interface.active form');
      if (activeForm) {
        activeForm.querySelector('button[type="submit"]').click();
      }
    }
  });
});

// Load the default interface
loadLastOpenedInterface();

function switchInterface(interfaceId) {
  document.querySelectorAll('.interface').forEach(function (el) {
    el.classList.remove('active');
  });
  document.getElementById(interfaceId).classList.add('active');
  if (interfaceId === 'interface-1') {
    displayGroupsAndPages1();
  } else if (interfaceId === 'interface-2') {
    updateCalendar();
  } else if (interfaceId === 'interface-3') {
    loadNoteSelection(loadNotes);
  }
}

function saveLastOpenedInterface(interfaceId) {
  chrome.storage.local.set({ lastOpenedInterface: interfaceId });
}

function lastSelectedInterface3() {
  loadNoteSelection(loadNotes);
}

function loadLastOpenedInterface() {
  chrome.storage.local.get('lastOpenedInterface', function (result) {
    const lastOpenedInterface = result.lastOpenedInterface || 'interface-1';
    if (lastOpenedInterface === 'interface-2') {
      loadCalendarSelection();
    } else if (lastOpenedInterface === 'interface-3') {
      lastSelectedInterface3();
    }
    switchInterface(lastOpenedInterface);
  });
}

// Interface 1 functions
function savePage1(e) {
  e.preventDefault();
  savePage('group-select-1', 'group-input-1', 'message-1', 'pages1', 'groups1', displayGroupsAndPages1, 'save-form-1');
}

function savePage(groupSelectId, groupInputId, messageId, storagePagesKey, storageGroupsKey, displayFunc, formId) {
  const groupSelect = document.getElementById(groupSelectId);
  const groupInput = document.getElementById(groupInputId);
  const selectedGroup = groupSelect.value;
  const newGroup = groupInput.value.trim();

  const date = new Date();
  const options = { month: 'long', day: 'numeric', weekday: 'long' };
  const defaultGroup = date.toLocaleDateString('en-US', options);

  const group = newGroup !== '' ? newGroup : (selectedGroup !== '' ? selectedGroup : defaultGroup);

  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    const tab = tabs[0];
    const page = {
      url: tab.url,
      title: tab.title,
      group: group,
      favicon: `https://www.google.com/s2/favicons?domain=${new URL(tab.url).hostname}`,
      timestamp: new Date().getTime()
    };

    chrome.storage.local.get({ [storagePagesKey]: [], [storageGroupsKey]: [] }, function (result) {
      const pages = result[storagePagesKey];
      const existingPage = pages.find(p => p.url === page.url);

      if (existingPage) {
        if (existingPage.group === page.group) {
          document.getElementById(messageId).textContent = 'Item Saved Already';
        } else {
          document.getElementById(messageId).textContent = `This page is already saved in the group: ${existingPage.group}`;
        }
        return;
      }

      pages.unshift(page);  // Add the new page at the beginning
      const groups = result[storageGroupsKey].includes(group) ? result[storageGroupsKey] : [...result[storageGroupsKey], group];

      chrome.storage.local.set({ [storagePagesKey]: pages, [storageGroupsKey]: groups }, function () {
        displayFunc();
        updateGroupSelect(groupSelectId, storageGroupsKey);
        document.getElementById(formId).reset();
        document.getElementById(messageId).textContent = 'Item Saved Successfully';
        updateCalendar(); // Update calendar to show saved items count
      });
    });
  });
}


function displayGroupsAndPages1() {
  displayGroupsAndPages('search-input-1', 'groups-list-1', 'pages1', 'groups1');
}

function displayGroupsAndPages(searchInputId, listId, storagePagesKey, storageGroupsKey) {
  const searchKeyword = document.getElementById(searchInputId).value.toLowerCase();

  chrome.storage.local.get({ [storageGroupsKey]: [], [storagePagesKey]: [] }, function (result) {
    const groups = result[storageGroupsKey];
    let pages = result[storagePagesKey];

    if (searchKeyword) {
      pages = pages.filter(page => page.title.toLowerCase().includes(searchKeyword));
    }

    const list = document.getElementById(listId);
    list.innerHTML = '';

    const sortedGroups = groups.sort((a, b) => {
      const dateA = new Date(a.split(', ')[1]);
      const dateB = new Date(b.split(', ')[1]);
      return dateB - dateA;
    });

    sortedGroups.forEach(group => {
      const groupLi = document.createElement('li');
      groupLi.className = 'group-container';
      groupLi.draggable = true;
      groupLi.dataset.group = group;
      groupLi.addEventListener('dragstart', handleDragStart);
      groupLi.addEventListener('dragover', handleDragOver);
      groupLi.addEventListener('drop', handleDrop);
      groupLi.addEventListener('dragend', handleDragEnd);

      const groupTitle = document.createElement('h3');
      groupTitle.textContent = group;
      groupTitle.contentEditable = false;
      groupTitle.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        showGroupContextMenu(e, groupTitle, group, storagePagesKey, storageGroupsKey);
      });
      groupLi.appendChild(groupTitle);

      const groupPages = document.createElement('ul');
      groupPages.style.maxHeight = '100px';
      groupPages.style.overflowY = 'auto';
      pages.filter(page => page.group === group).forEach(page => {
        const pageLi = document.createElement('li');
        pageLi.style.display = 'flex';
        pageLi.style.alignItems = 'center';

        const favicon = document.createElement('img');
        favicon.src = page.favicon;
        favicon.alt = 'favicon';
        favicon.style.width = '14px';
        favicon.style.height = '14px';
        favicon.style.marginRight = '5px';

        const pageTitle = document.createElement('a');
        pageTitle.href = page.url;
        pageTitle.target = '_blank';
        pageTitle.textContent = page.title;
        pageTitle.className = 'page-title';
        pageTitle.contentEditable = false;

        pageTitle.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          showItemContextMenu(e, pageTitle, page, storagePagesKey, pageLi);
        });

        const flagButton = document.createElement('button');
        flagButton.className = 'flag-button';
        flagButton.innerHTML = '<i class="fas fa-flag"></i>';
        flagButton.onclick = function() {
          this.classList.toggle('clicked');
          flagPage(page, storagePagesKey, this.classList.contains('clicked'));
        };

        if (page.flagged) {
          flagButton.classList.add('clicked');
          flagButton.querySelector('i').style.color = 'red';
        }

        const deleteButton = document.createElement('button');
        deleteButton.className = 'delete-button';
        deleteButton.innerHTML = '<i class="fas fa-times"></i>';
        deleteButton.onclick = () => deletePage(page, storagePagesKey);

        const notesButton = document.createElement('button');
        notesButton.className = 'notes-button';
        notesButton.innerHTML = '<i class="fas fa-eye"></i>';
        notesButton.onclick = () => showNotes(page, pageLi);

        pageLi.appendChild(favicon);
        pageLi.appendChild(pageTitle);
        pageLi.appendChild(flagButton);
        pageLi.appendChild(notesButton);
        pageLi.appendChild(deleteButton);
        groupPages.appendChild(pageLi);
      });

      groupLi.appendChild(groupPages);
      list.appendChild(groupLi);
    });
  });
}



function handleDragStart(e) {
  e.dataTransfer.setData('text/plain', e.target.dataset.group);
  e.dataTransfer.effectAllowed = 'move';
  e.target.classList.add('dragging');
}

function handleDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';

  const target = e.target.closest('.group-container');
  if (target) {
    const bounding = target.getBoundingClientRect();
    const offset = bounding.y + (bounding.height / 2);

    if (e.clientY - offset > 0) {
      target.style['border-bottom'] = '2px solid white';
      target.style['border-top'] = '';
    } else {
      target.style['border-top'] = '2px solid white';
      target.style['border-bottom'] = '';
    }
  }
}

function handleDrop(e) {
  e.preventDefault();
  const sourceGroup = e.dataTransfer.getData('text/plain');
  const target = e.target.closest('.group-container');
  if (target && target.dataset.group !== sourceGroup) {
    const groupsList = target.closest('ul');
    const groupContainers = Array.from(groupsList.children);
    const sourceIndex = groupContainers.findIndex(container => container.dataset.group === sourceGroup);
    const targetIndex = groupContainers.indexOf(target);

    const [movedGroup] = groupContainers.splice(sourceIndex, 1);
    groupContainers.splice(targetIndex, 0, movedGroup);

    groupsList.innerHTML = '';
    groupContainers.forEach(groupContainer => groupsList.appendChild(groupContainer));
  }

  Array.from(document.querySelectorAll('.group-container')).forEach(group => {
    group.style['border-top'] = '';
    group.style['border-bottom'] = '';
  });
}

function handleDragEnd(e) {
  e.target.classList.remove('dragging');
}

function editPageTitle(page, newTitle, storagePagesKey) {
  chrome.storage.local.get({ [storagePagesKey]: [] }, function (result) {
    const pages = result[storagePagesKey].map(p => {
      if (p.url === page.url && p.group === page.group) {
        p.title = newTitle;
      }
      return p;
    });
    chrome.storage.local.set({ [storagePagesKey]: pages }, function () {
      displayGroupsAndPages1();
    });
  });
}

function editGroupName(oldGroupName, newGroupName, storagePagesKey, storageGroupsKey) {
  if (newGroupName && newGroupName !== oldGroupName) {
    chrome.storage.local.get({ [storagePagesKey]: [], [storageGroupsKey]: [] }, function (result) {
      const pages = result[storagePagesKey].map(page => {
        if (page.group === oldGroupName) {
          page.group = newGroupName;
        }
        return page;
      });
      const groups = result[storageGroupsKey].map(g => (g === oldGroupName ? newGroupName : g));
      chrome.storage.local.set({ [storagePagesKey]: pages, [storageGroupsKey]: groups }, function () {
        displayGroupsAndPages1();
        updateGroupSelect1();
      });
    });
  }
}

function updateGroupSelect1() {
  updateGroupSelect('group-select-1', 'groups1');
}

function updateGroupSelect(groupSelectId, storageGroupsKey) {
  chrome.storage.local.get({ [storageGroupsKey]: [] }, function (result) {
    const groups = result[storageGroupsKey];
    const select = document.getElementById(groupSelectId);
    select.innerHTML = '<option value="">--Select Existing Group--</option>';
    groups.forEach(group => {
      const option = document.createElement('option');
      option.value = group;
      option.textContent = group;
      select.appendChild(option);
    });
  });
}

function deletePage(page, storagePagesKey) {
  chrome.storage.local.get({ [storagePagesKey]: [] }, function (result) {
    const pages = result[storagePagesKey].filter(p => !(p.url === page.url && p.group === page.group));
    chrome.storage.local.set({ [storagePagesKey]: pages }, function () {
      displayGroupsAndPages1();
      updateCalendar(); // Update calendar to remove deleted item
    });
  });
}

function flagPage(page, storagePagesKey, isFlagged) {
  chrome.storage.local.get({ [storagePagesKey]: [] }, function (result) {
    const pages = result[storagePagesKey].map(p => {
      if (p.url === page.url && p.group === page.group) {
        p.flagged = isFlagged;
      }
      return p;
    });
    chrome.storage.local.set({ [storagePagesKey]: pages }, function () {
      displayGroupsAndPages1();
    });
  });
}

function deleteGroup(group, storagePagesKey, storageGroupsKey) {
  chrome.storage.local.get({ [storagePagesKey]: [], [storageGroupsKey]: [] }, function (result) {
    const pages = result[storagePagesKey].filter(p => p.group !== group);
    const groups = result[storageGroupsKey].filter(g => g !== group);
    chrome.storage.local.set({ [storagePagesKey]: pages, [storageGroupsKey]: groups }, function () {
      displayGroupsAndPages1();
      updateGroupSelect1();
      updateCalendar(); // Update calendar to remove deleted group items
    });
  });
}

function showGroupContextMenu(event, groupTitle, group, storagePagesKey, storageGroupsKey) {
  const existingContextMenu = document.getElementById('context-menu');
  if (existingContextMenu) {
    document.body.removeChild(existingContextMenu);
  }

  const contextMenu = document.createElement('div');
  contextMenu.id = 'context-menu';
  contextMenu.style.position = 'absolute';
  contextMenu.style.top = `${event.pageY}px`;
  contextMenu.style.left = `${event.pageX}px`;
  contextMenu.style.backgroundColor = '#ecf0f1';
  contextMenu.style.padding = '10px';
  contextMenu.style.borderRadius = '15px';
  contextMenu.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.2)';

  const editOption = document.createElement('div');
  editOption.textContent = 'Edit Group';
  editOption.style.cursor = 'pointer';
  editOption.addEventListener('click', () => {
    groupTitle.contentEditable = true;
    groupTitle.focus();
    document.body.removeChild(contextMenu);
  });

  const deleteOption = document.createElement('div');
  deleteOption.textContent = 'Delete Group';
  deleteOption.className = 'delete-option';
  deleteOption.style.cursor = 'pointer';
  deleteOption.addEventListener('click', () => {
    showDeleteConfirmation(group, storagePagesKey, storageGroupsKey);
    document.body.removeChild(contextMenu);
  });

  contextMenu.appendChild(editOption);
  contextMenu.appendChild(deleteOption);
  document.body.appendChild(contextMenu);

  document.addEventListener('click', () => {
    if (document.body.contains(contextMenu)) {
      document.body.removeChild(contextMenu);
    }
  }, { once: true });

  groupTitle.addEventListener('blur', () => {
    groupTitle.contentEditable = false;
    editGroupName(group, groupTitle.textContent, storagePagesKey, storageGroupsKey);
  });
}

function exportPages1() {
  exportPages('pages1');
}

function exportPages(storagePagesKey) {
  chrome.storage.local.get({ [storagePagesKey]: [] }, function (result) {
    const pages = result[storagePagesKey];
    let csvContent = "data:text/csv;charset=utf-8,Day of the Week,Month Day,Date,Item,URL,Flagged,Notes\n";

    pages.forEach(page => {
      const flagged = page.flagged ? 'YES' : 'NO';
      const notes = page.notes ? page.notes.replace(/"/g, '""') : '';
      const row = `${page.group},${new Date(page.timestamp).toLocaleDateString()},"${page.title}",${page.url},${flagged},"${notes}"`;
      csvContent += row + "\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "saved_pages.csv");
    document.body.appendChild(link);

    link.click();
    document.body.removeChild(link);
  });
}


function showDeleteConfirmation(group, storagePagesKey, storageGroupsKey) {
  const confirmationDialog = document.createElement('div');
  confirmationDialog.id = 'confirmation-dialog';
  confirmationDialog.style.position = 'fixed';
  confirmationDialog.style.top = '50%';
  confirmationDialog.style.left = '50%';
  confirmationDialog.style.transform = 'translate(-50%, -50%)';
  confirmationDialog.style.backgroundColor = '#ecf0f1';
  confirmationDialog.style.padding = '20px';
  confirmationDialog.style.borderRadius = '15px';
  confirmationDialog.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.2)';
  confirmationDialog.innerHTML = `
    <p class="confirmation-text">Are you sure you want to delete this group and all its items? This action can't be undone.</p>
    <div class="button-container">
      <button id="confirm-delete" class="delete-button">Delete</button>
      <button id="cancel-delete" class="cancel-button">Cancel</button>
    </div>
  `;

  document.body.appendChild(confirmationDialog);

  document.getElementById('confirm-delete').addEventListener('click', () => {
    deleteGroup(group, storagePagesKey, storageGroupsKey);
    document.body.removeChild(confirmationDialog);
  });

  document.getElementById('cancel-delete').addEventListener('click', () => {
    document.body.removeChild(confirmationDialog);
  });
}

function loadColorScheme() {
  chrome.storage.local.get('colorScheme', function (result) {
    if (result.colorScheme) {
      document.body.className = result.colorScheme;
    }
  });
}

// Flagged item function
function displayFlaggedItems(year, month, day) {
  const flaggedItemsContainer = document.getElementById('flagged-items-container');
  flaggedItemsContainer.innerHTML = '';

  chrome.storage.local.get({ pages1: [] }, function (result) {
    const pages = result.pages1;
    const flaggedItems = pages.filter(page => {
      const pageDate = new Date(page.timestamp);
      return page.flagged && pageDate.getFullYear() === year && pageDate.getMonth() === month && pageDate.getDate() === day;
    });

    if (flaggedItems.length > 0) {
      flaggedItems.forEach(item => {
        const itemDiv = document.createElement('div');
        itemDiv.classList.add('flagged-item');
        itemDiv.innerHTML = `
          <img src="${item.favicon}" alt="favicon" style="width: 16px; height: 16px; margin-right: 5px;">
          <a href="${item.url}" target="_blank">${item.title}</a>
        `;
        flaggedItemsContainer.appendChild(itemDiv);
      });
    } else {
      flaggedItemsContainer.innerHTML = '<p>No flagged items for this date.</p>';
    }
  });
}

// Interface 2 functions
function saveCalendarSelection() {
  const selectedMonth = document.getElementById('calendar__month').value;
  const selectedYear = document.getElementById('calendar__year').value;
  chrome.storage.local.set({ calendarSelection: { month: selectedMonth, year: selectedYear } });
}

function loadCalendarSelection() {
  chrome.storage.local.get('calendarSelection', function (result) {
    const calendarSelection = result.calendarSelection || { month: new Date().getMonth(), year: new Date().getFullYear() };
    document.getElementById('calendar__month').value = calendarSelection.month;
    document.getElementById('calendar__year').value = calendarSelection.year;
  });
}

function updateCalendar() {
  const monthSelect = document.getElementById('calendar__month');
  const yearSelect = document.getElementById('calendar__year');
  const datesContainer = document.getElementById('calendar__dates');

  const selectedMonth = parseInt(monthSelect.value);
  const selectedYear = parseInt(yearSelect.value);

  // Clear the previous dates
  datesContainer.innerHTML = '';

  const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
  const firstDay = new Date(selectedYear, selectedMonth, 1).getDay();

  // Fill in the blanks before the first day
  for (let i = 0; i < firstDay; i++) {
    const emptyDiv = document.createElement('div');
    emptyDiv.classList.add('calendar__date', 'calendar__date--grey');
    datesContainer.appendChild(emptyDiv);
  }

  // Get saved pages data to show counts
  chrome.storage.local.get({ pages1: [] }, function (result) {
    const pages = result.pages1;
    const savedDatesCount = {};
    const dailyGoal = parseInt(localStorage.getItem('dailyGoal')) || 0;

    pages.forEach(page => {
      const date = new Date(page.timestamp);
      const year = date.getFullYear();
      const month = date.getMonth();
      const day = date.getDate();

      if (year === selectedYear && month === selectedMonth) {
        if (!savedDatesCount[day]) {
          savedDatesCount[day] = 0;
        }
        savedDatesCount[day]++;
      }
    });

    // Fill in the actual days
    for (let day = 1; day <= daysInMonth; day++) {
      const dayDiv = document.createElement('div');
      dayDiv.classList.add('calendar__date');
      dayDiv.innerHTML = `<span>${day}</span>`;

      // Mark today
      const today = new Date();
      if (day === today.getDate() && selectedMonth === today.getMonth() && selectedYear === today.getFullYear()) {
        dayDiv.classList.add('calendar__date--today');
      }

      // Mark saved dates with count
      if (savedDatesCount[day]) {
        dayDiv.classList.add('calendar__date--saved');
        dayDiv.setAttribute('data-count', savedDatesCount[day]);

        // Shade the date green if daily goal is met
        if (savedDatesCount[day] >= dailyGoal) {
          dayDiv.classList.add('calendar__date--goal-met');
        }
      }

      dayDiv.addEventListener('mouseenter', function() {
        dayDiv.classList.add('calendar__date--hover');
      });
      dayDiv.addEventListener('mouseleave', function() {
        dayDiv.classList.remove('calendar__date--hover');
      });

      dayDiv.addEventListener('click', function() {
        displayFlaggedItems(selectedYear, selectedMonth, day);
      });

      datesContainer.appendChild(dayDiv);
    }
  });
}

function setDailyGoal() {
  const dailyGoalInput = document.getElementById('daily-goal-input');
  const dailyGoal = parseInt(dailyGoalInput.value);
  if (!isNaN(dailyGoal)) {
    chrome.storage.local.set({ dailyGoal: dailyGoal }, function () {
      updateCalendar();
    });
  }
}

function showItemContextMenu(event, pageTitle, page, storagePagesKey, pageLi) {
  const existingContextMenu = document.getElementById('context-menu');
  if (existingContextMenu) {
    document.body.removeChild(existingContextMenu);
  }

  const contextMenu = document.createElement('div');
  contextMenu.id = 'context-menu';
  contextMenu.style.position = 'absolute';
  contextMenu.style.top = `${event.pageY}px`;
  contextMenu.style.left = `${event.pageX}px`;
  contextMenu.style.backgroundColor = '#ecf0f1';
  contextMenu.style.padding = '10px';
  contextMenu.style.borderRadius = '15px';
  contextMenu.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.2)';

  const editOption = document.createElement('div');
  editOption.textContent = 'Edit Item';
  editOption.style.cursor = 'pointer';
  editOption.addEventListener('click', () => {
    pageTitle.contentEditable = true;
    pageTitle.focus();
    document.body.removeChild(contextMenu);

    const saveTitle = () => {
      pageTitle.contentEditable = false;
      editPageTitle(page, pageTitle.textContent, storagePagesKey);
    };

    pageTitle.addEventListener('blur', saveTitle, { once: true });
    pageTitle.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        saveTitle();
      }
    });
  });

  const addNotesOption = document.createElement('div');
  addNotesOption.textContent = 'Add Notes';
  addNotesOption.style.cursor = 'pointer';
  addNotesOption.addEventListener('click', () => {
    addNotes(page, storagePagesKey, pageLi);
    document.body.removeChild(contextMenu);
  });

  contextMenu.appendChild(editOption);
  contextMenu.appendChild(addNotesOption);
  document.body.appendChild(contextMenu);

  document.addEventListener('click', () => {
    if (document.body.contains(contextMenu)) {
      document.body.removeChild(contextMenu);
    }
  }, { once: true });
}

function editPageTitle(page, newTitle, storagePagesKey) {
  chrome.storage.local.get({ [storagePagesKey]: [] }, function (result) {
    const pages = result[storagePagesKey].map(p => {
      if (p.url === page.url && p.group === page.group) {
        p.title = newTitle;
      }
      return p;
    });
    chrome.storage.local.set({ [storagePagesKey]: pages }, function () {
      displayGroupsAndPages1();
    });
  });
}

function showNotes(page, pageLi) {
  let notesElement = pageLi.querySelector('.notes-text');
  if (!notesElement) {
    notesElement = document.createElement('div');
    notesElement.className = 'notes-text';
    notesElement.contentEditable = true;
    notesElement.style.border = '1px solid #ccc';
    notesElement.style.marginLeft = '10px';
    notesElement.style.padding = '5px';
    pageLi.appendChild(notesElement);
  }
  notesElement.textContent = page.notes || '';
  notesElement.style.display = 'block';

  notesElement.addEventListener('blur', () => {
    const newNotes = notesElement.textContent;
    chrome.storage.local.get({ pages1: [] }, function (result) {
      const pages = result.pages1.map(p => {
        if (p.url === page.url && p.group === page.group) {
          p.notes = newNotes;
        }
        return p;
      });
      chrome.storage.local.set({ pages1: pages }, function () {
        displayGroupsAndPages1();
      });
    });
  });
}


function addNotes(page, storagePagesKey, pageLi) {
  let notesElement = pageLi.querySelector('.notes-text');
  if (!notesElement) {
    notesElement = document.createElement('div');
    notesElement.className = 'notes-text';
    notesElement.contentEditable = true;
    notesElement.style.border = '1px solid #ccc';
    notesElement.style.marginLeft = '10px';
    notesElement.style.padding = '5px';
    notesElement.style.width = '300px';  // Fixed width
    notesElement.style.height = '100px'; // Fixed height
    pageLi.appendChild(notesElement);
  }
  notesElement.textContent = page.notes || '';
  notesElement.style.display = 'block';

  notesElement.addEventListener('blur', () => {
    const newNotes = notesElement.textContent;
    chrome.storage.local.get({ [storagePagesKey]: [] }, function (result) {
      const pages = result[storagePagesKey].map(p => {
        if (p.url === page.url && p.group === page.group) {
          p.notes = newNotes;
        }
        return p;
      });
      chrome.storage.local.set({ [storagePagesKey]: pages }, function () {
        displayGroupsAndPages1();
      });
    });
  });
}


