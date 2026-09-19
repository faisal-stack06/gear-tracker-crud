import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  getFirestore,
  serverTimestamp,
  setDoc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

let isAdmin = localStorage.getItem("isAdmin") === "true";
let isSubmitting = false;

const firebaseConfig = {
  apiKey: "AIzaSyCAcHHuYQMsNiuAD-UsVWhWNVqKcTrbHIY",
  authDomain: "registry-crud-logistic-app.firebaseapp.com",
  projectId: "registry-crud-logistic-app",
  storageBucket: "registry-crud-logistic-app.firebasestorage.app",
  messagingSenderId: "812955718970",
  appId: "1:812955718970:web:9d7e2732ecabd0d25fac03",
  measurementId: "G-BB3Y5J6SX1"
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

function checkAdminAccess() {
  isAdmin = localStorage.getItem("isAdmin") === "true";

  if (!isAdmin) {
    window.location.href = "login.html";
    return;
  }

  const restrictedElements = document.querySelectorAll(".btn-delete, .delete-button, .edit-button, #assetForm, #eventForm");

  for (let index = 0; index < restrictedElements.length; index++) {
    restrictedElements[index].style.display = isAdmin ? "" : "none";
  }
}

function setFormState({ message, type }) {
  const formMessage = document.getElementById("formMessage");

  if (formMessage) {
    formMessage.textContent = message;
    formMessage.className = `form-message ${type}`.trim();
  }
}

function normalizeAssetStatus(status) {
  return String(status ?? "").trim().toLowerCase();
}

function showOperationError(message) {
  alert(message);
  setFormState({ message, type: "error" });
}

function notifyDashboardStatsUpdated() {
  localStorage.setItem("dashboardStatsUpdatedAt", Date.now().toString());
}

function debounce(callback, delay) {
  let timeoutId;

  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => callback(...args), delay);
  };
}

function sortByCreatedAt(records) {
  return records.sort((first, second) => {
    const firstTime = first.created_at && first.created_at.toMillis ? first.created_at.toMillis() : 0;
    const secondTime = second.created_at && second.created_at.toMillis ? second.created_at.toMillis() : 0;
    return secondTime - firstTime;
  });
}

async function getCollectionRecords(collectionName) {
  const snapshot = await getDocs(collection(db, collectionName));
  return snapshot.docs.map((record) => ({ id: record.id, ...record.data() }));
}

async function updateAssetStatuses(assetIds, status, destination) {
  const normalizedStatus = normalizeAssetStatus(status);
  const updatedAssetIds = [];

  for (let index = 0; index < assetIds.length; index++) {
    await updateDoc(doc(db, "assets", assetIds[index]), {
      status: normalizedStatus,
      destination
    });
    updatedAssetIds.push(assetIds[index]);
  }

  return updatedAssetIds;
}

async function loadDashboardStats() {
  const assets = await getCollectionRecords("assets");
  const events = await getCollectionRecords("events");
  const activeAssets = assets.filter((asset) => asset.is_deleted !== true);
  const inTransitAssets = activeAssets.filter((asset) => normalizeAssetStatus(asset.status) === "in_transit");
  const activeEvents = events.filter((event) => event.is_deleted !== true && normalizeAssetStatus(event.status) !== "completed");

  document.getElementById("totalAssetsStat").textContent = activeAssets.length;
  document.getElementById("inTransitAssetsStat").textContent = inTransitAssets.length;
  document.getElementById("activeEventsStat").textContent = activeEvents.length;
}

async function loadEventLog(eventLogTable) {
  const tableBody = eventLogTable.getElementsByTagName("tbody")[0];
  tableBody.replaceChildren();

  try {
    const events = sortByCreatedAt((await getCollectionRecords("events")).filter((event) => event.is_deleted !== true));

    for (let index = 0; index < events.length; index++) {
      const eventRecord = events[index];
      const row = document.createElement("tr");
      const values = [eventRecord.event_name, eventRecord.location, `${eventRecord.start_date} - ${eventRecord.end_date}`];

      for (let valueIndex = 0; valueIndex < values.length; valueIndex++) {
        const cell = document.createElement("td");
        cell.textContent = values[valueIndex] ?? "";
        row.append(cell);
      }

      const eventStatus = normalizeAssetStatus(eventRecord.status);
      const statusCell = document.createElement("td");
      const statusButton = document.createElement("button");
      statusButton.className = `btn-status ${eventStatus === "completed" ? "status-completed" : "status-active"}`;
      statusButton.dataset.id = eventRecord.id;
      statusButton.dataset.currentStatus = eventStatus;
      statusButton.dataset.location = eventRecord.location ?? "";
      statusButton.textContent = eventStatus === "completed" ? "Completed" : "Active";
      statusCell.append(statusButton);
      row.append(statusCell);

      const actionCell = document.createElement("td");
      const detailsButton = document.createElement("button");
      detailsButton.className = "btn-secondary btn-details";
      detailsButton.dataset.id = eventRecord.id;
      detailsButton.dataset.name = eventRecord.event_name ?? "";
      detailsButton.textContent = "Details";
      actionCell.append(detailsButton);

      const deleteButton = document.createElement("button");
      deleteButton.className = "btn-delete";
      deleteButton.dataset.id = eventRecord.id;
      deleteButton.textContent = "Delete";
      actionCell.append(deleteButton);
      row.append(actionCell);
      tableBody.append(row);
    }

    checkAdminAccess();
  } catch (error) {
    const errorRow = document.createElement("tr");
    const errorCell = document.createElement("td");
    errorCell.colSpan = 5;
    errorCell.textContent = `Unable to load event log: ${error.message}`;
    errorRow.append(errorCell);
    tableBody.append(errorRow);
    showOperationError(`Unable to load event log: ${error.message}`);
  }
}

async function getEventItems(eventId) {
  const items = await getCollectionRecords("event_items");
  return items.filter((item) => item.event_id === eventId && item.asset_id);
}

async function deleteEvent(eventId, reloadEventLog) {
  const events = await getCollectionRecords("events");
  const eventRecord = events.find((event) => event.id === eventId && event.is_deleted !== true);

  if (!eventRecord) {
    throw new Error("Event is no longer active.");
  }

  const items = await getEventItems(eventId);
  const assetIds = items.map((item) => item.asset_id);
  const allItems = await getCollectionRecords("event_items");
  const otherItems = allItems.filter((item) => item.event_id !== eventId && assetIds.includes(item.asset_id));
  const allEvents = await getCollectionRecords("events");
  const activeEventIds = new Set(allEvents.filter((event) => event.is_deleted !== true && normalizeAssetStatus(event.status) !== "completed").map((event) => event.id));
  const activeAssetIds = new Set(otherItems.filter((item) => activeEventIds.has(item.event_id)).map((item) => item.asset_id));
  const releasableAssetIds = assetIds.filter((assetId) => !activeAssetIds.has(assetId));
  let releasedAssetIds = [];

  try {
    releasedAssetIds = await updateAssetStatuses(releasableAssetIds, "available", "Sekretariat UBV");
    await updateDoc(doc(db, "events", eventId), { is_deleted: true });
    notifyDashboardStatsUpdated();
    await reloadEventLog();
  } catch (error) {
    if (releasedAssetIds.length > 0) {
      try {
        await updateAssetStatuses(releasedAssetIds, "in_transit", eventRecord.location ?? "");
      } catch (rollbackError) {
        throw new Error(`${error.message}; rollback failed: ${rollbackError.message}`);
      }
    }

    throw error;
  }
}

async function showManifest(eventId, manifestTableBody) {
  const items = await getEventItems(eventId);
  const assets = await getCollectionRecords("assets");
  const assetsById = new Map(assets.map((asset) => [asset.id, asset]));
  manifestTableBody.replaceChildren();

  for (let index = 0; index < items.length; index++) {
    const row = document.createElement("tr");
    const outCell = document.createElement("td");
    const inCell = document.createElement("td");
    const itemCell = document.createElement("td");
    const asset = assetsById.get(items[index].asset_id);
    outCell.textContent = "[ ]";
    inCell.textContent = "[ ]";
    itemCell.textContent = asset ? asset.item_name : items[index].custom_item_name ?? "";
    row.append(outCell, inCell, itemCell);
    manifestTableBody.append(row);
  }
}

checkAdminAccess();

const logoutButton = document.getElementById("logoutBtn");

if (logoutButton) {
  logoutButton.addEventListener("click", () => {
    localStorage.removeItem("isAdmin");
    window.location.href = "login.html";
  });
}

if (document.getElementById("dashboardStats")) {
  loadDashboardStats().catch((error) => showOperationError(`Unable to load dashboard statistics: ${error.message}`));
  window.addEventListener("storage", (event) => {
    if (event.key === "dashboardStatsUpdatedAt") {
      loadDashboardStats().catch((error) => showOperationError(`Unable to load dashboard statistics: ${error.message}`));
    }
  });
}

if (document.getElementById("eventLogTable")) {
  const eventLogTable = document.getElementById("eventLogTable");
  const manifestModal = document.getElementById("manifestModal");
  const manifestEventName = document.getElementById("manifestEventName");
  const manifestTableBody = document.getElementById("manifestTableBody");
  const closeManifestButton = document.getElementById("closeManifestBtn");
  const printManifestButton = document.getElementById("printManifestBtn");

  eventLogTable.addEventListener("click", async (event) => {
    if (event.target.classList.contains("btn-delete")) {
      if (!confirm("Are you sure you want to delete this event? Assets will be returned to base.")) {
        return;
      }

      try {
        await deleteEvent(event.target.dataset.id, () => loadEventLog(eventLogTable));
      } catch (error) {
        showOperationError(`Unable to delete event: ${error.message}`);
      }
      return;
    }

    if (event.target.classList.contains("btn-details")) {
      manifestEventName.textContent = event.target.dataset.name;
      manifestModal.style.display = "block";

      try {
        await showManifest(event.target.dataset.id, manifestTableBody);
      } catch (error) {
        showOperationError(`Unable to load manifest: ${error.message}`);
      }
      return;
    }

    if (!event.target.classList.contains("btn-status")) {
      return;
    }

    const eventId = event.target.dataset.id;
    const newStatus = event.target.dataset.currentStatus === "completed" ? "active" : "completed";

    try {
      const items = await getEventItems(eventId);
      const assetIds = items.map((item) => item.asset_id);
      await updateDoc(doc(db, "events", eventId), { status: newStatus });

      if (assetIds.length > 0) {
        const destination = newStatus === "completed" ? "Sekretariat UBV" : event.target.dataset.location;
        await updateAssetStatuses(assetIds, newStatus === "completed" ? "available" : "in_transit", destination);
      }

      notifyDashboardStatsUpdated();
      await loadEventLog(eventLogTable);
    } catch (error) {
      showOperationError(`Unable to update event status: ${error.message}`);
    }
  });

  closeManifestButton.addEventListener("click", () => {
    manifestModal.style.display = "none";
  });

  printManifestButton.addEventListener("click", () => {
    window.print();
  });

  loadEventLog(eventLogTable);
}

if (document.getElementById("assetForm")) {
  const assetForm = document.getElementById("assetForm");
  const submitButton = document.getElementById("submitButton");
  const cancelButton = document.getElementById("cancelButton");
  const assetsTable = document.getElementById("assetsTable");
  const searchInput = document.getElementById("searchInput");

  async function fetchAssets() {
    const assets = sortByCreatedAt((await getCollectionRecords("assets")).filter((asset) => asset.is_deleted !== true));
    renderAssets(assets);
  }

  function renderAssets(assets, errorMessage = "") {
    const tableHead = document.createElement("thead");
    const headerRow = document.createElement("tr");
    const tableBody = document.createElement("tbody");
    const columns = ["Item Name", "Category", "Status", "Destination", "Action"];

    for (let index = 0; index < columns.length; index++) {
      const headerCell = document.createElement("th");
      headerCell.scope = "col";
      headerCell.textContent = columns[index];
      if (columns[index] === "Action") {
        headerCell.className = "action-column";
      }
      headerRow.append(headerCell);
    }

    tableHead.append(headerRow);

    for (let index = 0; index < assets.length; index++) {
      const row = document.createElement("tr");
      const values = [assets[index].item_name, assets[index].category, assets[index].status, assets[index].destination];

      for (let valueIndex = 0; valueIndex < values.length; valueIndex++) {
        const cell = document.createElement("td");
        cell.textContent = values[valueIndex] ?? "";
        row.append(cell);
      }

      const actionCell = document.createElement("td");
      actionCell.className = "action-column";
      const editButton = document.createElement("button");
      editButton.type = "button";
      editButton.className = "edit-button";
      editButton.dataset.action = "edit";
      editButton.dataset.id = assets[index].id;
      editButton.dataset.itemName = assets[index].item_name ?? "";
      editButton.dataset.category = assets[index].category ?? "";
      editButton.dataset.status = assets[index].status ?? "";
      editButton.dataset.destination = assets[index].destination ?? "";
      editButton.textContent = "Edit";
      actionCell.append(editButton);

      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.className = "delete-button";
      deleteButton.dataset.action = "delete";
      deleteButton.dataset.id = assets[index].id;
      deleteButton.textContent = "Delete";
      actionCell.append(deleteButton);
      row.append(actionCell);
      tableBody.append(row);
    }

    assetsTable.replaceChildren(tableHead, tableBody);

    if (errorMessage) {
      const errorRow = document.createElement("tr");
      const errorCell = document.createElement("td");
      errorCell.colSpan = columns.length;
      errorCell.textContent = errorMessage;
      errorRow.append(errorCell);
      tableBody.append(errorRow);
    }

    checkAdminAccess();
  }

  const filterAssets = () => {
    const searchText = searchInput.value.toLowerCase();
    const rows = assetsTable.getElementsByTagName("tbody")[0].rows;

    for (let index = 0; index < rows.length; index++) {
      const itemName = rows[index].cells[0].textContent.toLowerCase();
      const category = rows[index].cells[1].textContent.toLowerCase();
      rows[index].style.display = itemName.includes(searchText) || category.includes(searchText) ? "" : "none";
    }
  };

  async function addAsset() {
    const formData = new FormData(assetForm);
    const assetId = formData.get("assetId");
    const asset = {
      item_name: String(formData.get("item_name") ?? "").trim(),
      category: String(formData.get("category") ?? "").trim(),
      status: normalizeAssetStatus(formData.get("status")),
      destination: String(formData.get("destination") ?? "").trim()
    };

    if (!asset.item_name || !asset.category || !asset.destination) {
      setFormState({ message: "Item name, category, and destination cannot be empty.", type: "error" });
      return;
    }

    if (!asset.status || asset.status === "select status") {
      showOperationError("Please select a valid asset status.");
      return;
    }

    if (asset.status === "available") {
      asset.destination = "Sekretariat UBV";
    }

    if (assetId) {
      const eventItems = await getCollectionRecords("event_items");
      const eventIds = eventItems.filter((item) => item.asset_id === assetId).map((item) => item.event_id);
      const events = await getCollectionRecords("events");

      if (asset.status === "available" && events.some((event) => eventIds.includes(event.id) && event.is_deleted !== true && normalizeAssetStatus(event.status) !== "completed")) {
        showOperationError("This asset cannot be marked available while assigned to an active event.");
        return;
      }
    }

    try {
      if (assetId) {
        await updateDoc(doc(db, "assets", assetId), asset);
      } else {
        await addDoc(collection(db, "assets"), { ...asset, is_deleted: false, created_at: serverTimestamp() });
      }

      resetEditState();
      setFormState({ message: assetId ? "Asset updated successfully." : "Asset added successfully.", type: "success" });
      await fetchAssets();
      notifyDashboardStatsUpdated();
    } catch (error) {
      showOperationError(`Unable to save asset: ${error.message}`);
    }
  }

  function editAsset(event) {
    const editButton = event.target.closest("[data-action=edit]");

    if (!editButton) {
      return;
    }

    document.getElementById("assetId").value = editButton.dataset.id;
    document.getElementById("item_name").value = editButton.dataset.itemName;
    document.getElementById("category").value = editButton.dataset.category;
    document.getElementById("status").value = editButton.dataset.status;
    document.getElementById("destination").value = editButton.dataset.destination;
    submitButton.textContent = "Update asset";
    cancelButton.hidden = false;
    setFormState({ message: "Editing selected asset.", type: "" });
    document.getElementById("item_name").focus();
  }

  function resetEditState() {
    assetForm.reset();
    document.getElementById("assetId").value = "";
    submitButton.textContent = "Add Asset";
    cancelButton.hidden = true;
  }

  async function deleteAsset(assetId) {
    if (!confirm("Delete this asset from the active registry?")) {
      return;
    }

    try {
      const assets = await getCollectionRecords("assets");
      const asset = assets.find((record) => record.id === assetId && record.is_deleted !== true);

      if (!asset) {
        throw new Error("Unable to find an active asset to delete.");
      }

      if (normalizeAssetStatus(asset.status) === "in_transit") {
        throw new Error("Assets in transit cannot be deleted.");
      }

      await updateDoc(doc(db, "assets", assetId), { is_deleted: true });
      setFormState({ message: "Asset deleted successfully.", type: "success" });
      await fetchAssets();
      notifyDashboardStatsUpdated();
    } catch (error) {
      showOperationError(`Unable to delete asset: ${error.message}`);
    }
  }

  assetForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const assetFormData = new FormData(assetForm);
    const assetFields = [
      assetFormData.get("item_name"),
      assetFormData.get("category"),
      assetFormData.get("status"),
      assetFormData.get("destination")
    ];

    if (assetFields.some((field) => !String(field ?? "").trim()) || normalizeAssetStatus(assetFormData.get("status")) === "select status") {
      alert("Please complete all asset fields before submitting.");
      return;
    }

    if (isSubmitting) {
      return;
    }

    isSubmitting = true;
    submitButton.disabled = true;
    submitButton.textContent = "Memproses...";
    addAsset()
      .catch((error) => showOperationError(`Unable to save asset: ${error.message}`))
      .finally(() => {
        isSubmitting = false;
        submitButton.disabled = false;
        submitButton.textContent = document.getElementById("assetId").value ? "Update asset" : "Add Asset";
      });
  });

  cancelButton.addEventListener("click", resetEditState);
  searchInput.addEventListener("input", debounce(filterAssets, 300));
  assetsTable.addEventListener("click", editAsset);
  assetsTable.addEventListener("click", (event) => {
    const deleteButton = event.target.closest("[data-action=delete]");

    if (deleteButton) {
      deleteAsset(deleteButton.dataset.id);
    }
  });

  fetchAssets().catch((error) => showOperationError(`Unable to load assets: ${error.message}`));
}

if (document.getElementById("eventForm")) {
  const eventForm = document.getElementById("eventForm");
  const assetChecklist = document.getElementById("assetChecklist");
  const openModalButton = document.getElementById("openModalBtn");
  const closeModalButton = document.getElementById("closeModalBtn");
  const assetModal = document.getElementById("assetModal");

  async function loadAvailableAssets() {
    const assets = await getCollectionRecords("assets");
    const availableAssets = assets.filter((asset) => asset.is_deleted !== true && normalizeAssetStatus(asset.status) === "available");
    assetChecklist.replaceChildren();

    for (let index = 0; index < availableAssets.length; index++) {
      const label = document.createElement("label");
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.name = "assetIds";
      checkbox.value = availableAssets[index].id;
      label.append(checkbox, document.createTextNode(availableAssets[index].item_name ?? ""));
      assetChecklist.append(label);
    }
  }

  async function rollbackCreatedEvent(eventId, updatedAssetIds) {
    for (let index = 0; index < updatedAssetIds.length; index++) {
      await updateAssetStatuses([updatedAssetIds[index]], "available", "Sekretariat UBV");
    }

    const eventItems = await getCollectionRecords("event_items");
    const createdItems = eventItems.filter((item) => item.event_id === eventId);

    for (let index = 0; index < createdItems.length; index++) {
      await deleteDoc(doc(db, "event_items", createdItems[index].id));
    }

    await deleteDoc(doc(db, "events", eventId));
  }

  async function createEvent() {
    const eventName = String(document.getElementById("eventName").value ?? "").trim();
    const location = String(document.getElementById("eventLocation").value ?? "").trim();
    const startDate = document.getElementById("startDate").value;
    const endDate = document.getElementById("endDate").value;
    const checkboxes = assetChecklist.getElementsByTagName("input");
    const selectedAssetIds = [];

    for (let index = 0; index < checkboxes.length; index++) {
      if (checkboxes[index].checked) {
        selectedAssetIds.push(checkboxes[index].value);
      }
    }

    if (!eventName || !location) {
      setFormState({ message: "Event name and location cannot be empty.", type: "error" });
      return;
    }

    if (!startDate || !endDate) {
      setFormState({ message: "Start date and end date are required.", type: "error" });
      return;
    }

    if (endDate < startDate) {
      setFormState({ message: "End date cannot be before start date.", type: "error" });
      return;
    }

    if (selectedAssetIds.length === 0) {
      setFormState({ message: "Select at least one asset.", type: "error" });
      return;
    }

    const assets = await getCollectionRecords("assets");
    const availableAssetIds = assets.filter((asset) => asset.is_deleted !== true && normalizeAssetStatus(asset.status) === "available").map((asset) => asset.id);

    if (selectedAssetIds.some((assetId) => !availableAssetIds.includes(assetId))) {
      alert("One or more selected assets are no longer available. Please refresh the asset list and try again.");
      await loadAvailableAssets();
      return;
    }

    const eventReference = await addDoc(collection(db, "events"), {
      event_name: eventName,
      location,
      start_date: startDate,
      end_date: endDate,
      status: "active",
      is_deleted: false,
      created_at: serverTimestamp()
    });
    const updatedAssetIds = [];

    try {
      for (let index = 0; index < selectedAssetIds.length; index++) {
        await addDoc(collection(db, "event_items"), { event_id: eventReference.id, asset_id: selectedAssetIds[index] });
        await updateAssetStatuses([selectedAssetIds[index]], "in_transit", location);
        updatedAssetIds.push(selectedAssetIds[index]);
      }

      eventForm.reset();
      setFormState({ message: "Event created successfully.", type: "success" });
      await loadAvailableAssets();
      notifyDashboardStatsUpdated();
    } catch (error) {
      try {
        await rollbackCreatedEvent(eventReference.id, updatedAssetIds);
      } catch (rollbackError) {
        throw new Error(`${error.message}; rollback failed: ${rollbackError.message}`);
      }

      throw error;
    }
  }

  openModalButton.addEventListener("click", () => {
    assetModal.style.display = "block";
  });

  closeModalButton.addEventListener("click", () => {
    assetModal.style.display = "none";
  });

  eventForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const eventFields = [
      document.getElementById("eventName").value,
      document.getElementById("eventLocation").value,
      document.getElementById("startDate").value,
      document.getElementById("endDate").value
    ];

    if (eventFields.some((field) => !String(field ?? "").trim())) {
      alert("Please complete all event fields before submitting.");
      return;
    }

    if (isSubmitting) {
      return;
    }

    isSubmitting = true;
    const submitButton = eventForm.querySelector("button[type=submit]");
    submitButton.disabled = true;
    submitButton.textContent = "Memproses...";
    createEvent()
      .catch((error) => showOperationError(`Unable to create event: ${error.message}`))
      .finally(() => {
        isSubmitting = false;
        submitButton.disabled = false;
        submitButton.textContent = "Create Event";
      });
  });

  loadAvailableAssets().catch((error) => showOperationError(`Unable to load available assets: ${error.message}`));
}
