const SUPABASE_URL = "https://tsmynpxmxfjdthhgonow.supabase.co/rest/v1/";
const SUPABASE_ANON_KEY = "sb_publishable_LAKA901Ubhz1g7en9ZvkMA_vLiQfbXk";
const supabaseProjectUrl = SUPABASE_URL.replace(/\/rest\/v1\/?$/, "");
const supabaseClient = window.supabase.createClient(supabaseProjectUrl, SUPABASE_ANON_KEY);

const assetForm = document.querySelector("#assetForm");
const submitButton = document.querySelector("#submitButton");
const formMessage = document.querySelector("#formMessage");

assetForm.addEventListener("submit", (event) => {
  event.preventDefault();
  addAsset();
});

document.addEventListener("DOMContentLoaded", () => {
  fetchAssets();
});

async function addAsset() {
  const formData = new FormData(assetForm);
  const asset = {
    item_name: formData.get("item_name").trim(),
    category: formData.get("category").trim(),
    status: formData.get("status"),
    destination: formData.get("destination").trim()
  };

  setFormState({ message: "Saving asset...", type: "", disabled: true });

  try {
    const { error } = await supabaseClient
      .from("assets")
      .insert(asset);

    if (error) {
      setFormState({ message: `Unable to save asset: ${error.message}`, type: "error", disabled: false });
      return;
    }

    assetForm.reset();
    setFormState({ message: "Asset added successfully.", type: "success", disabled: false });
    fetchAssets();
  } catch (error) {
    setFormState({ message: `Unable to save asset: ${error.message}`, type: "error", disabled: false });
  }
}

async function fetchAssets() {
  try {
    const { data, error } = await supabaseClient
      .from("assets")
      .select("item_name, category, status, destination")
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
    actionCell.textContent = "-";
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

function setFormState({ message, type, disabled }) {
  formMessage.textContent = message;
  formMessage.className = `form-message ${type}`.trim();
  submitButton.disabled = disabled;
}
