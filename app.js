const SUPABASE_URL = "https://tsmynpxmxfjdthhgonow.supabase.co/rest/v1/";
const SUPABASE_ANON_KEY = "sb_publishable_LAKA901Ubhz1g7en9ZvkMA_vLiQfbXk";
const supabaseProjectUrl = SUPABASE_URL.replace(/\/rest\/v1\/?$/, "");
const supabaseClient = window.supabase.createClient(supabaseProjectUrl, SUPABASE_ANON_KEY);

const assetForm = document.querySelector("#assetForm");
const submitButton = document.querySelector("#submitButton");
const cancelButton = document.querySelector("#cancelButton");
const formMessage = document.querySelector("#formMessage");
const assetsTable = document.querySelector("#assetsTable");
const searchInput = document.querySelector("#searchInput");
const printButton = document.querySelector("#printBtn");

assetForm.addEventListener("submit", (event) => {
  event.preventDefault();
  addAsset();
});

cancelButton.addEventListener("click", resetEditState);

printButton.addEventListener("click", () => {
  window.print();
});

searchInput.addEventListener("keyup", () => {
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
});

document.addEventListener("DOMContentLoaded", () => {
  fetchAssets();
});

async function addAsset() {
  const formData = new FormData(assetForm);
  const assetId = formData.get("assetId");
  const asset = {
    item_name: formData.get("item_name").trim(),
    category: formData.get("category").trim(),
    status: formData.get("status"),
    destination: formData.get("destination").trim()
  };

  setFormState({ message: "Saving asset...", type: "", disabled: true });

  try {
    const query = assetId
      ? supabaseClient.from("assets").update(asset).eq("id", assetId)
      : supabaseClient.from("assets").insert(asset);
    const { error } = await query;

    if (error) {
      setFormState({ message: `Unable to save asset: ${error.message}`, type: "error", disabled: false });
      return;
    }

    resetEditState();
    setFormState({
      message: assetId ? "Asset updated successfully." : "Asset added successfully.",
      type: "success",
      disabled: false
    });
    fetchAssets();
  } catch (error) {
    setFormState({ message: `Unable to save asset: ${error.message}`, type: "error", disabled: false });
  }
}

function editAsset(event) {
  const editButton = event.target.closest("[data-action=edit]");

  if (!editButton) {
    return;
  }

  document.querySelector("#assetId").value = editButton.dataset.id;
  document.querySelector("#item_name").value = editButton.dataset.itemName;
  document.querySelector("#category").value = editButton.dataset.category;
  document.querySelector("#status").value = editButton.dataset.status;
  document.querySelector("#destination").value = editButton.dataset.destination;
  submitButton.textContent = "Update asset";
  cancelButton.hidden = false;
  setFormState({ message: "Editing selected asset.", type: "", disabled: false });
  document.querySelector("#item_name").focus();
}

function resetEditState() {
  assetForm.reset();
  document.querySelector("#assetId").value = "";
  submitButton.textContent = "Add asset";
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
  const table = document.querySelector("#assetsTable");
  const tableHead = document.createElement("thead");
  const headerRow = document.createElement("tr");
  const tableBody = document.createElement("tbody");
  const columns = ["Item Name", "Category", "Status", "Destination", "Action"];

  columns.forEach((column) => {
    const headerCell = document.createElement("th");
    headerCell.scope = "col";
    if (column === "Action") {
      headerCell.className = "action-column";
    }
    headerCell.textContent = column;
    headerRow.append(headerCell);
  });
  tableHead.append(headerRow);

  assets.forEach((asset) => {
    const row = document.createElement("tr");
    const values = [asset.item_name, asset.category, asset.status, asset.destination];

    values.forEach((value) => {
      const cell = document.createElement("td");
      cell.textContent = value ?? "";
      row.append(cell);
    });

    const actionCell = document.createElement("td");
    actionCell.className = "action-column";
    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.className = "edit-button";
    editButton.dataset.action = "edit";
    editButton.dataset.id = asset.id;
    editButton.dataset.itemName = asset.item_name ?? "";
    editButton.dataset.category = asset.category ?? "";
    editButton.dataset.status = asset.status ?? "";
    editButton.dataset.destination = asset.destination ?? "";
    editButton.textContent = "Edit";
    actionCell.append(editButton);

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "delete-button";
    deleteButton.dataset.action = "delete";
    deleteButton.dataset.id = asset.id;
    deleteButton.textContent = "Delete";
    actionCell.append(deleteButton);

    row.append(actionCell);
    tableBody.append(row);
  });

  table.replaceChildren(tableHead, tableBody);

  if (errorMessage) {
    const errorRow = document.createElement("tr");
    const errorCell = document.createElement("td");
    errorCell.colSpan = columns.length;
    errorCell.textContent = errorMessage;
    errorRow.append(errorCell);
    tableBody.append(errorRow);
  }
}

assetsTable.addEventListener("click", editAsset);
assetsTable.addEventListener("click", (event) => {
  const deleteButton = event.target.closest("[data-action=delete]");

  if (deleteButton) {
    deleteAsset(deleteButton.dataset.id);
  }
});

async function deleteAsset(id) {
  const confirmed = window.confirm("Delete this asset from the active registry?");

  if (!confirmed) {
    return;
  }

  try {
    const { error } = await supabaseClient
      .from("assets")
      .update({ is_deleted: true })
      .eq("id", id);

    if (error) {
      setFormState({ message: `Unable to delete asset: ${error.message}`, type: "error", disabled: false });
      return;
    }

    setFormState({ message: "Asset deleted successfully.", type: "success", disabled: false });
    fetchAssets();
  } catch (error) {
    setFormState({ message: `Unable to delete asset: ${error.message}`, type: "error", disabled: false });
  }
}

function setFormState({ message, type, disabled }) {
  formMessage.textContent = message;
  formMessage.className = `form-message ${type}`.trim();
  submitButton.disabled = disabled;
}
