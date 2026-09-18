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
    const { error } = await supabase
      .from("assets")
      .insert(asset);

    if (error) {
      setFormState({ message: `Unable to save asset: ${error.message}`, type: "error", disabled: false });
      return;
    }

    assetForm.reset();
    setFormState({ message: "Asset added successfully.", type: "success", disabled: false });
  } catch (error) {
    setFormState({ message: `Unable to save asset: ${error.message}`, type: "error", disabled: false });
  }
}

function setFormState({ message, type, disabled }) {
  formMessage.textContent = message;
  formMessage.className = `form-message ${type}`.trim();
  submitButton.disabled = disabled;
}
