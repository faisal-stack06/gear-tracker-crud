let isAdmin = localStorage.getItem("isAdmin") === "true";
let isSubmitting = false;

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

checkAdminAccess();

const SUPABASE_URL = "https://tsmynpxmxfjdthhgonow.supabase.co/rest/v1/";
const SUPABASE_ANON_KEY = "sb_publishable_LAKA901Ubhz1g7en9ZvkMA_vLiQfbXk";
const supabaseProjectUrl = SUPABASE_URL.replace(/\/rest\/v1\/?$/, "");
const supabaseClient = window.supabase.createClient(supabaseProjectUrl, SUPABASE_ANON_KEY);

function setFormState({ message, type, disabled }) {
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
  setFormState({ message, type: "error", disabled: false });
}

const logoutButton = document.getElementById("logoutBtn");

if (logoutButton) {
  logoutButton.addEventListener("click", () => {
    localStorage.removeItem("isAdmin");
    window.location.href = "login.html";
  });
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

async function updateAssetStatuses(assetIds, status, destination) {
  return supabaseClient
    .from("assets")
    .update({ status: normalizeAssetStatus(status), destination })
    .in("id", assetIds)
    .eq("is_deleted", false)
    .select("id");
}

  checkAdminAccess();

if (document.getElementById("dashboardStats")) {
  const totalAssetsStat = document.getElementById("totalAssetsStat");
  const inTransitAssetsStat = document.getElementById("inTransitAssetsStat");
  const activeEventsStat = document.getElementById("activeEventsStat");

  async function loadDashboardStats() {
    const [totalAssetsResult, inTransitAssetsResult, eventsResult] = await Promise.all([
      supabaseClient
        .from("assets")
        .select("id", { count: "exact", head: true })
        .eq("is_deleted", false),
      supabaseClient
        .from("assets")
        .select("id", { count: "exact", head: true })
        .eq("is_deleted", false)
        .eq("status", normalizeAssetStatus("in_transit")),
      supabaseClient
        .from("events")
        .select("id, status")
        .eq("is_deleted", false)
    ]);

    const firstError = totalAssetsResult.error || inTransitAssetsResult.error || eventsResult.error;

    if (firstError) {
      showOperationError(`Unable to load dashboard statistics: ${firstError.message}`);
      return;
    }

    const activeEventCount = (eventsResult.data || []).filter(
      (event) => String(event.status ?? "").trim().toLowerCase() !== "completed"
    ).length;

    totalAssetsStat.textContent = totalAssetsResult.count ?? 0;
    inTransitAssetsStat.textContent = inTransitAssetsResult.count ?? 0;
    activeEventsStat.textContent = activeEventCount;
  }

  window.addEventListener("storage", (event) => {
    if (event.key === "dashboardStatsUpdatedAt") {
      loadDashboardStats();
    }
  });

  loadDashboardStats();
}

if (document.getElementById("eventLogTable")) {
  const eventLogTable = document.getElementById("eventLogTable");
  const manifestModal = document.getElementById("manifestModal");
  const manifestEventName = document.getElementById("manifestEventName");
  const manifestTableBody = document.getElementById("manifestTableBody");
  const closeManifestButton = document.getElementById("closeManifestBtn");
  const printManifestButton = document.getElementById("printManifestBtn");

  async function loadEventLog() {
    const { data, error } = await supabaseClient
      .from("events")
      .select("id, event_name, location, start_date, end_date, status")
      .eq("is_deleted", false)
      .order("created_at", { ascending: false });

    const tableBody = eventLogTable.getElementsByTagName("tbody")[0];
    tableBody.replaceChildren();

    if (error) {
      const errorRow = document.createElement("tr");
      const errorCell = document.createElement("td");
      errorCell.colSpan = 5;
      errorCell.textContent = `Unable to load event log: ${error.message}`;
      errorRow.append(errorCell);
      tableBody.append(errorRow);
      return;
    }

    for (let index = 0; index < data.length; index++) {
      const row = document.createElement("tr");
      const values = [
        data[index].event_name,
        data[index].location,
        `${data[index].start_date} - ${data[index].end_date}`
      ];

      for (let valueIndex = 0; valueIndex < values.length; valueIndex++) {
        const cell = document.createElement("td");
        cell.textContent = values[valueIndex] ?? "";
        row.append(cell);
      }

      const statusCell = document.createElement("td");
      const statusButton = document.createElement("button");
      const eventStatus = String(data[index].status ?? "").trim().toLowerCase();
      statusButton.className = `btn-status ${eventStatus === "completed" ? "status-completed" : "status-active"}`;
      statusButton.dataset.id = data[index].id;
      statusButton.dataset.currentStatus = eventStatus;
      statusButton.dataset.location = data[index].location;
      statusButton.textContent = eventStatus === "completed" ? "Completed" : "Active";
      statusCell.append(statusButton);
      row.append(statusCell);

      const actionCell = document.createElement("td");
      const detailsButton = document.createElement("button");
      detailsButton.className = "btn-secondary btn-details";
      detailsButton.dataset.id = data[index].id;
      detailsButton.dataset.name = data[index].event_name;
      detailsButton.style.padding = "0.25rem 0.75rem";
      detailsButton.style.marginLeft = "0.5rem";
      detailsButton.style.fontSize = "0.8rem";
      detailsButton.textContent = "Details";
      actionCell.append(detailsButton);

      const deleteButton = document.createElement("button");
      deleteButton.className = "btn-delete";
      deleteButton.dataset.id = data[index].id;
      deleteButton.style.color = "red";
      deleteButton.style.border = "1px solid red";
      deleteButton.style.background = "transparent";
      deleteButton.style.cursor = "pointer";
      deleteButton.style.padding = "0.25rem 0.5rem";
      deleteButton.style.marginLeft = "0.5rem";
      deleteButton.style.fontSize = "0.8rem";
      deleteButton.textContent = "Delete";
      actionCell.append(deleteButton);
      row.append(actionCell);

      tableBody.append(row);
    }

  }

  eventLogTable.addEventListener("click", async (event) => {
    if (event.target.classList.contains("btn-delete")) {
      const clickedId = event.target.dataset.id;

      if (!confirm("Are you sure you want to delete this event? Assets will be returned to base.")) {
        return;
      }

      const { data: eventRecord, error: eventRecordError } = await supabaseClient
        .from("events")
        .select("id, location")
        .eq("id", clickedId)
        .eq("is_deleted", false)
        .maybeSingle();

      if (eventRecordError || !eventRecord) {
        showOperationError(eventRecordError ? `Unable to load event: ${eventRecordError.message}` : "Event is no longer active.");
        return;
      }

      const { data: items, error: itemsError } = await supabaseClient
        .from("event_items")
        .select("asset_id")
        .eq("event_id", clickedId)
        .not("asset_id", "is", null);

      if (itemsError) {
        showOperationError(`Unable to load event assets: ${itemsError.message}`);
        return;
      }

      const assetIds = (items || []).map((item) => item.asset_id);
      const { data: otherItems, error: otherItemsError } = assetIds.length > 0
        ? await supabaseClient
          .from("event_items")
          .select("event_id, asset_id")
          .in("asset_id", assetIds)
          .neq("event_id", clickedId)
        : { data: [], error: null };

      if (otherItemsError) {
        showOperationError(`Unable to check other event assignments: ${otherItemsError.message}`);
        return;
      }

      const otherEventIds = [...new Set((otherItems || []).map((item) => item.event_id))];
      const { data: otherEvents, error: otherEventsError } = otherEventIds.length > 0
        ? await supabaseClient
          .from("events")
          .select("id, status")
          .in("id", otherEventIds)
          .eq("is_deleted", false)
        : { data: [], error: null };

      if (otherEventsError) {
        showOperationError(`Unable to check active events: ${otherEventsError.message}`);
        return;
      }

      const activeEventIds = new Set(
        (otherEvents || [])
          .filter((otherEvent) => otherEvent.status !== "completed")
          .map((otherEvent) => otherEvent.id)
      );
      const activeAssetIds = new Set(
        (otherItems || [])
          .filter((item) => activeEventIds.has(item.event_id))
          .map((item) => item.asset_id)
      );
      const releasableAssetIds = assetIds.filter((assetId) => !activeAssetIds.has(assetId));

      if (releasableAssetIds.length > 0) {
        const { data: updatedAssets, error: assetUpdateError } = await updateAssetStatuses(
          releasableAssetIds,
          "available",
          "Sekretariat UBV"
        );

        if (assetUpdateError || (updatedAssets || []).length !== releasableAssetIds.length) {
          const partiallyUpdatedAssetIds = (updatedAssets || []).map((asset) => asset.id);

          if (partiallyUpdatedAssetIds.length > 0) {
            const { error: rollbackError } = await updateAssetStatuses(
              partiallyUpdatedAssetIds,
              "in_transit",
              eventRecord.location
            );

            if (rollbackError) {
              showOperationError(`Unable to roll back asset status: ${rollbackError.message}`);
              return;
            }
          }

          showOperationError(assetUpdateError ? `Unable to update asset status: ${assetUpdateError.message}` : "Unable to update all asset statuses.");
          return;
        }
      }

      const { data: deletedEvent, error: deleteEventError } = await supabaseClient
        .from("events")
        .update({ is_deleted: true })
        .eq("id", clickedId)
        .eq("is_deleted", false)
        .select("id")
        .maybeSingle();

      if (deleteEventError || !deletedEvent) {
        if (releasableAssetIds.length > 0) {
          const { error: rollbackError } = await updateAssetStatuses(
            releasableAssetIds,
            "in_transit",
            eventRecord.location
          );

          if (rollbackError) {
            showOperationError(`Unable to roll back event asset status: ${rollbackError.message}`);
            return;
          }
        }

        showOperationError(deleteEventError ? `Unable to delete event: ${deleteEventError.message}` : "Event was not deleted because its state changed.");
        return;
      }

      notifyDashboardStatsUpdated();
      await loadEventLog();
      return;
    }

    if (event.target.classList.contains("btn-details")) {
      const eventId = event.target.dataset.id;
      manifestEventName.textContent = event.target.dataset.name;
      manifestTableBody.replaceChildren();
      manifestModal.style.display = "block";

      const { data, error } = await supabaseClient
        .from("event_items")
        .select("*, assets(item_name)")
        .eq("event_id", eventId);

      if (error) {
        const errorRow = document.createElement("tr");
        const errorCell = document.createElement("td");
        errorCell.colSpan = 3;
        errorCell.textContent = `Unable to load manifest: ${error.message}`;
        errorRow.append(errorCell);
        manifestTableBody.append(errorRow);
        return;
      }

      for (let index = 0; index < data.length; index++) {
        const row = document.createElement("tr");
        const outCell = document.createElement("td");
        const inCell = document.createElement("td");
        const itemCell = document.createElement("td");
        const outBox = document.createElement("div");
        const inBox = document.createElement("div");

        outBox.style.width = "20px";
        outBox.style.height = "20px";
        outBox.style.border = "1px solid #000";
        inBox.style.width = "20px";
        inBox.style.height = "20px";
        inBox.style.border = "1px solid #000";
        itemCell.textContent = data[index].assets ? data[index].assets.item_name : data[index].custom_item_name;
        outCell.append(outBox);
        inCell.append(inBox);
        row.append(outCell, inCell, itemCell);
        manifestTableBody.append(row);
      }

      return;
    }

    if (!event.target.classList.contains("btn-status")) {
      return;
    }

    const eventId = event.target.dataset.id;
    const currentStatus = String(event.target.dataset.currentStatus ?? "").trim().toLowerCase();
    const newStatus = currentStatus === "completed" ? "active" : "completed";
    const { error } = await supabaseClient
      .from("events")
      .update({ status: newStatus })
      .eq("id", eventId);

    if (error) {
      showOperationError(`Unable to update event status: ${error.message}`);
      return;
    }

    if (!error) {
      const { data: items, error: itemsError } = await supabaseClient
        .from("event_items")
        .select("asset_id")
        .eq("event_id", eventId)
        .not("asset_id", "is", null);
      if (itemsError) {
        showOperationError(`Unable to load event assets: ${itemsError.message}`);
        return;
      }

      const assetIds = (items || []).map((item) => item.asset_id);

      if (assetIds.length > 0) {
        if (newStatus === "completed") {
          const { error: assetUpdateError } = await updateAssetStatuses(assetIds, "available", "Sekretariat UBV");

          if (assetUpdateError) {
            showOperationError(`Unable to update asset status: ${assetUpdateError.message}`);
            return;
          }
        } else {
          const newLocation = event.target.getAttribute("data-location");
          const { error: assetUpdateError } = await updateAssetStatuses(assetIds, "in_transit", newLocation);

          if (assetUpdateError) {
            showOperationError(`Unable to update asset status: ${assetUpdateError.message}`);
            return;
          }
        }
      }

      notifyDashboardStatsUpdated();
      loadEventLog();
    }
  });

  closeManifestButton.addEventListener("click", () => {
    manifestModal.style.display = "none";
  });

  printManifestButton.addEventListener("click", () => {
    window.print();
  });

  loadEventLog();
}

if (document.getElementById("assetForm")) {
  const assetForm = document.getElementById("assetForm");
  const submitButton = document.getElementById("submitButton");
  const cancelButton = document.getElementById("cancelButton");
  const assetsTable = document.getElementById("assetsTable");
  const searchInput = document.getElementById("searchInput");

  assetForm.addEventListener("submit", (event) => {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    isSubmitting = true;
    submitButton.disabled = true;
    submitButton.textContent = "Memproses...";
    addAsset()
      .catch((error) => {
        showOperationError(`Unable to save asset: ${error.message}`);
      })
      .finally(() => {
        isSubmitting = false;
        submitButton.disabled = false;
        submitButton.textContent = document.getElementById("assetId").value ? "Update asset" : "Add Asset";
      });
  });

  cancelButton.addEventListener("click", resetEditState);

  const filterAssets = () => {
    const searchText = searchInput.value.toLowerCase();
    const rows = assetsTable.getElementsByTagName("tbody")[0].rows;

    for (let index = 0; index < rows.length; index++) {
      const itemName = rows[index].cells[0].textContent.toLowerCase();
      const category = rows[index].cells[1].textContent.toLowerCase();

      if (itemName.includes(searchText) || category.includes(searchText)) {
        rows[index].style.display = "";
      } else {
        rows[index].style.display = "none";
      }
    }
  };

  searchInput.addEventListener("input", debounce(filterAssets, 300));

  assetsTable.addEventListener("click", editAsset);
  assetsTable.addEventListener("click", (event) => {
    const deleteButton = event.target.closest("[data-action=delete]");

    if (deleteButton) {
      deleteAsset(deleteButton.dataset.id);
    }
  });

  fetchAssets();

  async function addAsset() {
    const formData = new FormData(assetForm);
    const assetId = formData.get("assetId");
    const asset = {
      item_name: formData.get("item_name").trim(),
      category: formData.get("category").trim(),
      status: normalizeAssetStatus(formData.get("status")),
      destination: formData.get("destination").trim()
    };

    if (!asset.item_name || !asset.category || !asset.destination) {
      setFormState({ message: "Item name, category, and destination cannot be empty.", type: "error", disabled: false });
      return;
    }

    if (!asset.status || asset.status === normalizeAssetStatus("select status")) {
      showOperationError("Please select a valid asset status.");
      return;
    }

    if (asset.status === normalizeAssetStatus("available")) {
      asset.destination = "Sekretariat UBV";
    }

    if (assetId && asset.status === normalizeAssetStatus("available")) {
      const { data: eventItems, error: eventItemsError } = await supabaseClient
        .from("event_items")
        .select("event_id")
        .eq("asset_id", assetId);

      if (eventItemsError) {
        showOperationError(`Unable to verify asset usage: ${eventItemsError.message}`);
        return;
      }

      const eventIds = (eventItems || []).map((item) => item.event_id);

      if (eventIds.length > 0) {
        const { data: activeEvents, error: activeEventsError } = await supabaseClient
          .from("events")
          .select("id, status")
          .in("id", eventIds)
          .eq("is_deleted", false);

        if (activeEventsError) {
          showOperationError(`Unable to verify active events: ${activeEventsError.message}`);
          return;
        }

        if ((activeEvents || []).some((event) => event.status !== "completed")) {
          setFormState({ message: "This asset cannot be marked available while assigned to an active event.", type: "error", disabled: false });
          return;
        }
      }
    }

    setFormState({ message: "Saving asset...", type: "", disabled: true });

    try {
      const result = assetId
        ? await supabaseClient
          .from("assets")
          .update(asset)
          .eq("id", assetId)
          .eq("is_deleted", false)
          .select("id")
          .maybeSingle()
        : await supabaseClient.from("assets").insert(asset);
      const { data, error } = result;

      if (error) {
        showOperationError(`Unable to save asset: ${error.message}`);
        return;
      }

      if (assetId && !data) {
        showOperationError("The asset is no longer active and was not updated.");
        return;
      }

      resetEditState();
      setFormState({
        message: assetId ? "Asset updated successfully." : "Asset added successfully.",
        type: "success",
        disabled: false
      });
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
    setFormState({ message: "Editing selected asset.", type: "", disabled: false });
    document.getElementById("item_name").focus();
  }

  function resetEditState() {
    assetForm.reset();
    document.getElementById("assetId").value = "";
    submitButton.textContent = "Add Asset";
    cancelButton.hidden = true;
  }

  async function fetchAssets() {
    try {
      const { data, error } = await supabaseClient
        .from("assets")
        .select("id, item_name, category, status, destination")
        .eq("is_deleted", false)
        .order("created_at", { ascending: false });

      if (error) {
        renderAssets([], `Unable to load assets: ${error.message}`);
        return;
      }

      renderAssets(data);
    } catch (error) {
      renderAssets([], `Unable to load assets: ${error.message}`);
    }
  }

  function renderAssets(assets, errorMessage = "") {
    const tableHead = document.createElement("thead");
    const headerRow = document.createElement("tr");
    const tableBody = document.createElement("tbody");
    const columns = ["Item Name", "Category", "Status", "Destination", "Action"];

    for (let index = 0; index < columns.length; index++) {
      const headerCell = document.createElement("th");
      headerCell.scope = "col";

      if (columns[index] === "Action") {
        headerCell.className = "action-column";
      }

      headerCell.textContent = columns[index];
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

  async function deleteAsset(id) {
    const confirmed = window.confirm("Delete this asset from the active registry?");

    if (!confirmed) {
      return;
    }

    try {
      const { data: assetRecord, error: assetRecordError } = await supabaseClient
        .from("assets")
        .select("id, status")
        .eq("id", id)
        .eq("is_deleted", false)
        .maybeSingle();

      if (assetRecordError || !assetRecord) {
        showOperationError(assetRecordError ? `Unable to find asset: ${assetRecordError.message}` : "Unable to find an active asset to delete.");
        return;
      }

      if (normalizeAssetStatus(assetRecord.status) === normalizeAssetStatus("in_transit")) {
        showOperationError("Assets in transit cannot be deleted.");
        return;
      }

      const { data: deletedAsset, error } = await supabaseClient
        .from("assets")
        .update({ is_deleted: true })
        .eq("id", id)
        .eq("is_deleted", false)
        .eq("status", normalizeAssetStatus(assetRecord.status))
        .select("id")
        .maybeSingle();

      if (error) {
        showOperationError(`Unable to delete asset: ${error.message}`);
        return;
      }

      if (!deletedAsset) {
        showOperationError("The asset changed before it could be deleted.");
        return;
      }

      setFormState({ message: "Asset deleted successfully.", type: "success", disabled: false });
      await fetchAssets();
      notifyDashboardStatsUpdated();
    } catch (error) {
      showOperationError(`Unable to delete asset: ${error.message}`);
    }
  }
}

if (document.getElementById("eventForm")) {
  const eventForm = document.getElementById("eventForm");
  const assetChecklist = document.getElementById("assetChecklist");
  const openModalButton = document.getElementById("openModalBtn");
  const closeModalButton = document.getElementById("closeModalBtn");
  const assetModal = document.getElementById("assetModal");

  openModalButton.addEventListener("click", () => {
    assetModal.style.display = "block";
  });

  closeModalButton.addEventListener("click", () => {
    assetModal.style.display = "none";
  });

  eventForm.addEventListener("submit", (event) => {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    isSubmitting = true;
    const submitButton = eventForm.querySelector("button[type=submit]");
    submitButton.disabled = true;
    submitButton.textContent = "Memproses...";
    createEvent()
      .catch((error) => {
        showOperationError(`Unable to create event: ${error.message}`);
      })
      .finally(() => {
        isSubmitting = false;
        submitButton.disabled = false;
        submitButton.textContent = "Create Event";
      });
  });

  loadAvailableAssets();

  async function loadAvailableAssets() {
    const { data, error } = await supabaseClient
      .from("assets")
      .select("id, item_name")
      .in("status", [normalizeAssetStatus("available")])
      .eq("is_deleted", false)
      .order("item_name");

    if (error) {
      assetChecklist.textContent = `Unable to load available assets: ${error.message}`;
      return;
    }

    assetChecklist.replaceChildren();

    for (let index = 0; index < data.length; index++) {
      const label = document.createElement("label");
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.name = "assetIds";
      checkbox.value = data[index].id;
      label.append(checkbox, document.createTextNode(data[index].item_name));
      assetChecklist.append(label);
    }
  }

  async function createEvent() {
    const eventName = document.getElementById("eventName").value.trim();
    const location = document.getElementById("eventLocation").value.trim();
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
      setFormState({ message: "Event name and location cannot be empty.", type: "error", disabled: false });
      return;
    }

    if (!startDate || !endDate) {
      setFormState({ message: "Start date and end date are required.", type: "error", disabled: false });
      return;
    }

    if (endDate < startDate) {
      setFormState({ message: "End date cannot be before start date.", type: "error", disabled: false });
      return;
    }

    if (selectedAssetIds.length === 0) {
      setFormState({ message: "Select at least one asset.", type: "error", disabled: false });
      return;
    }

    const { data: availableAssets, error: availabilityError } = await supabaseClient
      .from("assets")
      .select("id, status")
      .in("id", selectedAssetIds)
      .in("status", [normalizeAssetStatus("available")])
      .eq("is_deleted", false);

    if (availabilityError) {
      showOperationError(`Unable to verify asset availability: ${availabilityError.message}`);
      return;
    }

    if ((availableAssets || []).length !== selectedAssetIds.length) {
      alert("One or more selected assets are no longer available. Please refresh the asset list and try again.");
      await loadAvailableAssets();
      return;
    }

    const { data, error } = await supabaseClient
      .from("events")
      .insert({ event_name: eventName, location, start_date: startDate, end_date: endDate })
      .select("id")
      .single();

    if (error) {
      showOperationError(`Unable to create event: ${error.message}`);
      return;
    }

    const updatedAssetIds = [];

    for (let index = 0; index < selectedAssetIds.length; index++) {
      const assetId = selectedAssetIds[index];
      const itemResult = await supabaseClient
        .from("event_items")
        .insert({ event_id: data.id, asset_id: assetId });

      if (itemResult.error) {
        const rollbackError = await rollbackCreatedEvent(data.id, updatedAssetIds);
        showOperationError(`Unable to add event asset: ${itemResult.error.message}`);
        if (rollbackError) {
          showOperationError(`Unable to roll back event: ${rollbackError.message}`);
        }
        return;
      }

      const assetResult = await updateAssetStatuses([assetId], "in_transit", location);

      if (assetResult.error) {
        const rollbackError = await rollbackCreatedEvent(data.id, updatedAssetIds);
        showOperationError(`Unable to update asset: ${assetResult.error.message}`);
        if (rollbackError) {
          showOperationError(`Unable to roll back event: ${rollbackError.message}`);
        }
        return;
      }

      updatedAssetIds.push(assetId);
    }

    eventForm.reset();
    setFormState({ message: "Event created successfully.", type: "success", disabled: false });
    await loadAvailableAssets();
    notifyDashboardStatsUpdated();
  }

  async function rollbackCreatedEvent(eventId, updatedAssetIds) {
    let rollbackError = null;

    if (updatedAssetIds.length > 0) {
      const { error } = await updateAssetStatuses(updatedAssetIds, "available", "Sekretariat UBV");

      rollbackError = error;
    }

    const { error: itemDeleteError } = await supabaseClient
      .from("event_items")
      .delete()
      .eq("event_id", eventId);

    if (itemDeleteError) {
      rollbackError = rollbackError || itemDeleteError;
    }

    const { error: eventDeleteError } = await supabaseClient
      .from("events")
      .delete()
      .eq("id", eventId);

    return rollbackError || eventDeleteError;
  }
}
