import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, query, orderBy, serverTimestamp, getDocs, doc, setDoc, writeBatch, onSnapshot, deleteDoc, updateDoc } from "firebase/firestore";
import { GoogleGenerativeAI } from "@google/generative-ai";


const firebaseConfig = {
  apiKey: "AIzaSyD-sUbdC9QLa6qNx7nhEfZhfUenG9gbk7I",
  authDomain: "dexter-ai-39dc5.firebaseapp.com",
  projectId: "dexter-ai-39dc5",
  storageBucket: "dexter-ai-39dc5.firebasestorage.app",
  messagingSenderId: "166098528181",
  appId: "1:166098528181:web:29d8ec869751b157eb5bfc",
  measurementId: "G-2VXFZYBVPQ"
};

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;


const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// PWA Service Worker Registration
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(err => console.warn('SW error:', err));
  });
}

// AI Personas Definition
const PERSONAS = {
  default: "You are Dexter, an intelligent, friendly, and highly capable AI assistant. Provide insightful, structured, clear, and accurate answers.",
  architect: "You are a Principal Software Architect and elite engineer. You write clean, modular, scalable, type-safe, production-grade code. You anticipate edge cases, recommend design patterns, and explain architectural decisions concisely.",
  tutor: "You are an elite academic professor and patient tutor. You break down complex STEM and general topics into intuitive, step-by-step explanations, utilizing analogies, real-world examples, and clear mathematical proofs where relevant.",
  writer: "You are an award-winning executive communications strategist and senior copywriter. You write crisp, compelling, polished, and persuasive prose with immaculate tone, clarity, and formatting.",
  debugger: "You are a seasoned senior security auditor and debugging specialist. You analyze code with laser focus on race conditions, memory leaks, performance bottlenecks, vulnerability vectors, and provide immediate hardened fixes."
};

let currentPersona = localStorage.getItem("dexter_persona") || "default";
let isWebSearchEnabled = false;

const messagesArea = document.getElementById("messages-area");
const chatForm = document.getElementById("chat-form");
const messageInput = document.getElementById("message-input");
const fileUpload = document.getElementById("file-upload");
const filePreviewContainer = document.getElementById("file-preview-container");
const imagePreview = document.getElementById("image-preview");
const filePreviewBadge = document.getElementById("file-preview-badge");
const filePreviewIcon = document.getElementById("file-preview-icon");
const filePreviewName = document.getElementById("file-preview-name");
const removeFileBtn = document.getElementById("remove-file-btn");
const themeToggleBtn = document.getElementById("theme-toggle");
const themeIcon = document.getElementById("theme-icon");
const sendButton = document.getElementById("send-button");
const chatContainer = document.getElementById("chat-container");
const scrollToBottomBtn = document.getElementById("scroll-to-bottom");
const voiceButton = document.getElementById("voice-button");
const voiceIcon = document.getElementById("voice-icon");
const toggleSidebarBtn = document.getElementById("toggle-sidebar");
const closeSidebarBtn = document.getElementById("close-sidebar");
const sidebar = document.getElementById("sidebar");
const sidebarBackdrop = document.getElementById("sidebar-backdrop");
const collapseInputBtn = document.getElementById("collapse-input-btn");
const collapsedInputPill = document.getElementById("collapsed-input-pill");
const disclaimerText = document.getElementById("disclaimer-text");
const personaSelect = document.getElementById("persona-select");
const exportChatBtn = document.getElementById("export-chat-btn");
const historySearchInput = document.getElementById("history-search-input");
const webSearchToggle = document.getElementById("web-search-toggle");
const webSearchIcon = document.getElementById("web-search-icon");
const sandboxModal = document.getElementById("sandbox-modal");
const sandboxIframe = document.getElementById("sandbox-iframe");
const closeSandboxBtn = document.getElementById("close-sandbox-btn");

const slashCommandsMenu = document.getElementById("slash-commands-menu");
const shortcutsBtn = document.getElementById("shortcuts-btn");
const shortcutsModal = document.getElementById("shortcuts-modal");
const closeShortcutsBtn = document.getElementById("close-shortcuts-btn");
const dragDropOverlay = document.getElementById("drag-drop-overlay");
const customInstructionsInput = document.getElementById("custom-instructions-input");
const ttsVoiceSelect = document.getElementById("tts-voice-select");
const ttsSpeedSlider = document.getElementById("tts-speed-slider");
const ttsSpeedVal = document.getElementById("tts-speed-val");
const testVoiceBtn = document.getElementById("test-voice-btn");
const renameModal = document.getElementById("rename-modal");
const renameForm = document.getElementById("rename-form");
const renameInput = document.getElementById("rename-input");
const closeRenameBtn = document.getElementById("close-rename-btn");
const cancelRenameBtn = document.getElementById("cancel-rename-btn");

let currentAttachedFile = null;
let lastUserMessage = "";
let lastUserFile = null;
let isRecording = false;
let activeRenamingSessionId = null;
let activeSessionHistory = [];


if (marked.use) {
  marked.use({
    breaks: true,
    gfm: true
  });
} else if (marked.setOptions) {
  marked.setOptions({
    breaks: true,
    gfm: true
  });
}


themeToggleBtn.addEventListener("click", () => {
  const htmlDoc = document.documentElement;
  if (htmlDoc.getAttribute("data-theme") === "dark") {
    htmlDoc.setAttribute("data-theme", "light");
    themeIcon.classList.replace("ph-sun", "ph-moon");
  } else {
    htmlDoc.setAttribute("data-theme", "dark");
    themeIcon.classList.replace("ph-moon", "ph-sun");
  }
});


function toggleSidebar() {
  sidebar.classList.toggle("-translate-x-full");
  if (sidebar.classList.contains("-translate-x-full")) {
    sidebarBackdrop.classList.add("hidden");
    sidebarBackdrop.classList.remove("opacity-100");
  } else {
    sidebarBackdrop.classList.remove("hidden");
   
    setTimeout(() => sidebarBackdrop.classList.add("opacity-100"), 10);
  }
}

toggleSidebarBtn.addEventListener("click", toggleSidebar);
closeSidebarBtn.addEventListener("click", toggleSidebar);
sidebarBackdrop.addEventListener("click", toggleSidebar);


const settingsModal = document.getElementById("settings-modal");
const openSettingsBtn = document.getElementById("open-settings-btn");
const closeSettingsBtn = document.querySelector(".close-settings");
const settingsBackdrop = document.querySelector(".modal-backdrop");
const settingsThemeToggle = document.getElementById("settings-theme-toggle");
const settingsThemeIcon = document.getElementById("settings-theme-icon");
const clearDataBtn = document.getElementById("clear-data-btn");

function toggleSettings() {
  if (settingsModal.classList.contains("hidden")) {
    settingsModal.classList.remove("hidden");
    settingsModal.classList.add("flex");
  } else {
    settingsModal.classList.add("hidden");
    settingsModal.classList.remove("flex");
  }
}

if(openSettingsBtn) openSettingsBtn.addEventListener("click", () => {
  if (window.innerWidth < 768) toggleSidebar();
  toggleSettings();
});
if(closeSettingsBtn) closeSettingsBtn.addEventListener("click", toggleSettings);
if(settingsBackdrop) settingsBackdrop.addEventListener("click", toggleSettings);

if(settingsThemeToggle) {
  settingsThemeToggle.addEventListener("click", () => {
    themeToggleBtn.click();
    if (document.documentElement.getAttribute("data-theme") === "dark") {
      settingsThemeIcon.classList.replace("ph-moon", "ph-sun");
    } else {
      settingsThemeIcon.classList.replace("ph-sun", "ph-moon");
    }
  });
}

if(clearDataBtn) {
  clearDataBtn.addEventListener("click", async () => {
    if(confirm("Are you sure you want to delete ALL chat history? This cannot be undone.")) {
      clearDataBtn.disabled = true;
      clearDataBtn.innerHTML = '<i class="ph ph-spinner animate-spin"></i> Clearing...';
      try {
        const q = query(collection(db, "sessions"));
        const snapshot = await getDocs(q);
        const batch = writeBatch(db);
        snapshot.forEach((doc) => {
          batch.delete(doc.ref);
        });
        await batch.commit();
        
        currentSessionId = null;
        clearMessages();
        loadSidebarSessions();
        toggleSettings();
      } catch (error) {
        console.error("Error clearing data:", error);
        alert("Failed to clear history.");
      } finally {
        clearDataBtn.disabled = false;
        clearDataBtn.innerHTML = '<i class="ph ph-trash"></i> Clear All Chat History';
      }
    }
  });
}


chatContainer.addEventListener("scroll", () => {
  const isScrolledUp = chatContainer.scrollHeight - chatContainer.scrollTop - chatContainer.clientHeight > 100;
  if (isScrolledUp) {
    scrollToBottomBtn.classList.remove("opacity-0", "translate-y-4", "pointer-events-none");
  } else {
    scrollToBottomBtn.classList.add("opacity-0", "translate-y-4", "pointer-events-none");
  }
});

scrollToBottomBtn.addEventListener("click", () => {
  scrollToBottom();
});


const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
if (SpeechRecognition) {
  const recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = true;

  recognition.onstart = () => {
    isRecording = true;
    voiceIcon.classList.replace("ph-microphone", "ph-stop-circle");
    voiceIcon.classList.add("text-red-500", "animate-pulse");
    messageInput.placeholder = "Listening...";
  };

  recognition.onresult = (event) => {
    let transcript = "";
    for (let i = 0; i < event.results.length; i++) {
      transcript += event.results[i][0].transcript;
    }
    messageInput.value = transcript;
    messageInput.style.height = 'auto';
    messageInput.style.height = (messageInput.scrollHeight) + 'px';
  };

  recognition.onerror = (event) => {
    console.error("Speech recognition error", event.error);
    stopRecording();
  };

  recognition.onend = () => {
    stopRecording();
  };

  function stopRecording() {
    isRecording = false;
    voiceIcon.classList.replace("ph-stop-circle", "ph-microphone");
    voiceIcon.classList.remove("text-red-500", "animate-pulse");
    messageInput.placeholder = "Message Dexter...";
  }

  voiceButton.addEventListener("click", () => {
    if (isRecording) {
      recognition.stop();
    } else {
      messageInput.value = "";
      recognition.start();
    }
  });
} else {
  voiceButton.style.display = "none";
}


// Persona Selector Listener
if (personaSelect) {
  personaSelect.value = currentPersona;
  personaSelect.addEventListener("change", (e) => {
    currentPersona = e.target.value;
    localStorage.setItem("dexter_persona", currentPersona);
  });
}

// Google Web Search Toggle
if (webSearchToggle) {
  webSearchToggle.addEventListener("click", () => {
    isWebSearchEnabled = !isWebSearchEnabled;
    if (isWebSearchEnabled) {
      webSearchToggle.classList.add("bg-indigo-500/20", "text-indigo-600", "dark:text-indigo-400", "ring-1", "ring-indigo-500/40");
      webSearchToggle.title = "Live Web Search: Enabled (Gemini Google Grounding)";
    } else {
      webSearchToggle.classList.remove("bg-indigo-500/20", "text-indigo-600", "dark:text-indigo-400", "ring-1", "ring-indigo-500/40");
      webSearchToggle.title = "Toggle Live Web Search";
    }
  });
}

// History Search
if (historySearchInput) {
  historySearchInput.addEventListener("input", (e) => {
    const term = e.target.value.toLowerCase().trim();
    const historyList = document.getElementById("chat-history-list");
    if (!historyList) return;
    const items = historyList.querySelectorAll("[data-session-id]");
    items.forEach(item => {
      const title = (item.innerText || "").toLowerCase();
      if (!term || title.includes(term)) {
        item.classList.remove("hidden");
      } else {
        item.classList.add("hidden");
      }
    });
  });
}

// Export Conversation
if (exportChatBtn) {
  exportChatBtn.addEventListener("click", () => {
    const allChildren = Array.from(messagesArea.children).filter(c => c.id !== "welcome-screen");
    if (allChildren.length === 0) {
      alert("No messages to export yet.");
      return;
    }
    let markdown = `# Dexter AI Conversation Export\n*Exported on ${new Date().toLocaleString()}*\n\n---\n\n`;
    allChildren.forEach(msg => {
      const isUser = msg.classList.contains("justify-end");
      const bubble = msg.querySelector(".markdown-body") || msg.querySelector(".bg-gradient-to-r");
      const text = bubble ? (bubble.dataset.rawText || bubble.innerText || "") : "";
      if (isUser) {
        markdown += `### 👤 User\n${text}\n\n`;
      } else {
        markdown += `### 🤖 Dexter AI\n${text}\n\n---\n\n`;
      }
    });

    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dexter-chat-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  });
}

// Sandbox Modal Logic
function openSandbox(code) {
  if (sandboxIframe && sandboxModal) {
    sandboxIframe.srcdoc = code;
    sandboxModal.classList.remove("hidden");
    sandboxModal.classList.add("flex");
  }
}
function closeSandbox() {
  if (sandboxModal && sandboxIframe) {
    sandboxModal.classList.add("hidden");
    sandboxModal.classList.remove("flex");
    sandboxIframe.srcdoc = "";
  }
}
if (closeSandboxBtn) closeSandboxBtn.addEventListener("click", closeSandbox);
if (sandboxModal) {
  sandboxModal.querySelector(".sandbox-backdrop")?.addEventListener("click", closeSandbox);
}

// Multi-Format File Upload Handling
// Multi-Format File Upload & Drag-and-Drop Handling
function handleSelectedFile(file) {
  if (!file) return;

  const isImage = file.type.startsWith("image/");
  const isAudio = file.type.startsWith("audio/");
  const isPdf = file.type === "application/pdf";
  const isText = file.type.startsWith("text/") || 
                 file.name.match(/\.(txt|md|csv|json|js|ts|py|html|css|xml|sql|sh)$/i);

  if (isImage) {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result;
      imagePreview.src = base64String;
      imagePreview.classList.remove("hidden");
      filePreviewBadge.classList.add("hidden");
      filePreviewContainer.classList.remove("hidden");

      currentAttachedFile = {
        type: "image",
        mimeType: file.type,
        base64Data: base64String.split(",")[1],
        dataUrl: base64String,
        name: file.name
      };
      expandInput();
    };
    reader.readAsDataURL(file);
  } else if (isAudio || isPdf) {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result;
      imagePreview.classList.add("hidden");
      filePreviewBadge.classList.remove("hidden");
      filePreviewBadge.classList.add("flex");
      filePreviewContainer.classList.remove("hidden");
      filePreviewName.textContent = file.name;
      filePreviewIcon.className = isAudio ? "ph ph-speaker-simple-high text-lg text-indigo-500" : "ph ph-file-pdf text-lg text-rose-500";

      currentAttachedFile = {
        type: isAudio ? "audio" : "pdf",
        mimeType: file.type || (isPdf ? "application/pdf" : "audio/mp3"),
        base64Data: base64String.split(",")[1],
        dataUrl: null,
        name: file.name
      };
      expandInput();
    };
    reader.readAsDataURL(file);
  } else if (isText) {
    const reader = new FileReader();
    reader.onloadend = () => {
      const textContent = reader.result;
      imagePreview.classList.add("hidden");
      filePreviewBadge.classList.remove("hidden");
      filePreviewBadge.classList.add("flex");
      filePreviewContainer.classList.remove("hidden");
      filePreviewName.textContent = file.name;
      filePreviewIcon.className = "ph ph-file-code text-lg text-indigo-500";

      currentAttachedFile = {
        type: "text",
        textContent: textContent,
        name: file.name
      };
      expandInput();
    };
    reader.readAsText(file);
  } else {
    alert("Unsupported file format. Please attach images, audio, PDF, or code/text files.");
  }
}

if (fileUpload) {
  fileUpload.addEventListener("change", (e) => {
    handleSelectedFile(e.target.files[0]);
  });
}

// Drag-and-Drop Anywhere Overlay Handlers
let dragCounter = 0;
window.addEventListener("dragenter", (e) => {
  e.preventDefault();
  dragCounter++;
  if (dragDropOverlay && e.dataTransfer && e.dataTransfer.types.includes("Files")) {
    dragDropOverlay.classList.remove("hidden");
    dragDropOverlay.classList.add("flex");
  }
});

window.addEventListener("dragover", (e) => {
  e.preventDefault();
});

window.addEventListener("dragleave", (e) => {
  e.preventDefault();
  dragCounter--;
  if (dragCounter <= 0 && dragDropOverlay) {
    dragCounter = 0;
    dragDropOverlay.classList.add("hidden");
    dragDropOverlay.classList.remove("flex");
  }
});

window.addEventListener("drop", (e) => {
  e.preventDefault();
  dragCounter = 0;
  if (dragDropOverlay) {
    dragDropOverlay.classList.add("hidden");
    dragDropOverlay.classList.remove("flex");
  }
  if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
    handleSelectedFile(e.dataTransfer.files[0]);
  }
});

// Custom System Instructions Persistence
if (customInstructionsInput) {
  customInstructionsInput.value = localStorage.getItem("dexter_custom_instructions") || "";
  customInstructionsInput.addEventListener("input", (e) => {
    localStorage.setItem("dexter_custom_instructions", e.target.value);
  });
}

// Text-to-Speech Customizer (Voices & Speed)
function populateTtsVoices() {
  if (!window.speechSynthesis || !ttsVoiceSelect) return;
  const voices = speechSynthesis.getVoices();
  if (voices.length === 0) return;
  const savedVoice = localStorage.getItem("dexter_tts_voice") || "";
  ttsVoiceSelect.innerHTML = '<option value="">Default System Voice</option>';
  voices.forEach(voice => {
    const option = document.createElement("option");
    option.value = voice.voiceURI;
    option.textContent = `${voice.name} (${voice.lang})`;
    if (voice.voiceURI === savedVoice) option.selected = true;
    ttsVoiceSelect.appendChild(option);
  });
}

if (window.speechSynthesis) {
  populateTtsVoices();
  speechSynthesis.onvoiceschanged = populateTtsVoices;
}

if (ttsVoiceSelect) {
  ttsVoiceSelect.addEventListener("change", (e) => {
    localStorage.setItem("dexter_tts_voice", e.target.value);
  });
}

if (ttsSpeedSlider && ttsSpeedVal) {
  const savedSpeed = localStorage.getItem("dexter_tts_speed") || "1.0";
  ttsSpeedSlider.value = savedSpeed;
  ttsSpeedVal.textContent = `${parseFloat(savedSpeed).toFixed(1)}x`;
  ttsSpeedSlider.addEventListener("input", (e) => {
    const val = parseFloat(e.target.value).toFixed(1);
    ttsSpeedVal.textContent = `${val}x`;
    localStorage.setItem("dexter_tts_speed", val);
  });
}

if (testVoiceBtn) {
  testVoiceBtn.addEventListener("click", () => {
    speakText("Hello! I am Dexter, your intelligent workspace companion.");
  });
}

// Keyboard Shortcuts Modal Toggle
function toggleShortcutsModal() {
  if (!shortcutsModal) return;
  if (shortcutsModal.classList.contains("hidden")) {
    shortcutsModal.classList.remove("hidden");
    shortcutsModal.classList.add("flex");
  } else {
    shortcutsModal.classList.add("hidden");
    shortcutsModal.classList.remove("flex");
  }
}

if (shortcutsBtn) shortcutsBtn.addEventListener("click", toggleShortcutsModal);
if (closeShortcutsBtn) closeShortcutsBtn.addEventListener("click", toggleShortcutsModal);
shortcutsModal?.querySelector(".shortcuts-backdrop")?.addEventListener("click", toggleShortcutsModal);

// Rename Session Modal Handlers
function openRenameModal(sessionId, currentTitle) {
  activeRenamingSessionId = sessionId;
  if (renameInput) renameInput.value = currentTitle || "";
  if (renameModal) {
    renameModal.classList.remove("hidden");
    renameModal.classList.add("flex");
    setTimeout(() => renameInput?.focus(), 50);
  }
}

function closeRenameModal() {
  activeRenamingSessionId = null;
  if (renameModal) {
    renameModal.classList.add("hidden");
    renameModal.classList.remove("flex");
  }
}

if (closeRenameBtn) closeRenameBtn.addEventListener("click", closeRenameModal);
if (cancelRenameBtn) cancelRenameBtn.addEventListener("click", closeRenameModal);
renameModal?.querySelector(".rename-backdrop")?.addEventListener("click", closeRenameModal);

if (renameForm) {
  renameForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!activeRenamingSessionId || !renameInput) return;
    const newTitle = renameInput.value.trim();
    if (newTitle) {
      try {
        await updateDoc(doc(db, "sessions", activeRenamingSessionId), {
          title: newTitle
        });
      } catch (err) {
        console.error("Error renaming chat session:", err);
      }
    }
    closeRenameModal();
  });
}

if (removeFileBtn) {
  removeFileBtn.addEventListener("click", clearAttachedFile);
}

function clearAttachedFile() {
  if (fileUpload) fileUpload.value = "";
  imagePreview.src = "";
  imagePreview.classList.add("hidden");
  filePreviewBadge.classList.add("hidden");
  filePreviewBadge.classList.remove("flex");
  filePreviewContainer.classList.add("hidden");
  currentAttachedFile = null;
}


const COMMAND_PREFIXES = {
  "/summarize": "Summarize this clearly with key takeaways: ",
  "/fix": "Analyze, debug, and fix any errors or bottlenecks in this code: ",
  "/explain": "Explain this concept in simple terms with everyday analogies: ",
  "/refactor": "Refactor and optimize this code according to clean code best practices: ",
  "/test": "Write comprehensive unit test cases and edge tests for: ",
  "/translate": "Translate this text accurately into English: "
};

function updateSlashCommandsMenu() {
  if (!slashCommandsMenu) return;
  const val = messageInput.value;
  if (val.startsWith("/") && !val.includes(" ")) {
    const query = val.toLowerCase();
    const items = slashCommandsMenu.querySelectorAll(".slash-item");
    let visibleCount = 0;
    items.forEach(item => {
      const cmd = item.dataset.cmd.toLowerCase();
      if (cmd.startsWith(query)) {
        item.classList.remove("hidden");
        visibleCount++;
      } else {
        item.classList.add("hidden");
      }
    });
    if (visibleCount > 0) {
      slashCommandsMenu.classList.remove("hidden");
    } else {
      slashCommandsMenu.classList.add("hidden");
    }
  } else {
    slashCommandsMenu.classList.add("hidden");
  }
}

messageInput.addEventListener('input', function() {
  this.style.height = 'auto';
  this.style.height = (this.scrollHeight) + 'px';
  if(this.value === '') this.style.height = 'auto';
  updateSlashCommandsMenu();
});

document.querySelectorAll(".slash-item").forEach(item => {
  item.addEventListener("click", () => {
    const cmd = item.dataset.cmd;
    const prefix = COMMAND_PREFIXES[cmd] || (cmd + " ");
    messageInput.value = prefix;
    if (slashCommandsMenu) slashCommandsMenu.classList.add("hidden");
    messageInput.focus();
    messageInput.style.height = 'auto';
    messageInput.style.height = (messageInput.scrollHeight) + 'px';
  });
});

messageInput.addEventListener('keydown', function(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    if (!sendButton.disabled && (messageInput.value.trim() || currentAttachedFile)) {
      chatForm.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    }
  }
});

function collapseInput() {
  chatForm.classList.add("hidden");
  if (disclaimerText) disclaimerText.classList.add("hidden");
  if (collapsedInputPill) {
    collapsedInputPill.classList.remove("hidden");
    collapsedInputPill.classList.add("flex");
  }
}

function expandInput() {
  if (collapsedInputPill) {
    collapsedInputPill.classList.add("hidden");
    collapsedInputPill.classList.remove("flex");
  }
  chatForm.classList.remove("hidden");
  if (disclaimerText) disclaimerText.classList.remove("hidden");
  messageInput.focus();
}

if (collapseInputBtn) {
  collapseInputBtn.addEventListener("click", collapseInput);
}

if (collapsedInputPill) {
  collapsedInputPill.addEventListener("click", expandInput);
}

window.addEventListener("keydown", (e) => {
  const isInputFocused = ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName);

  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    if (chatForm.classList.contains("hidden")) {
      expandInput();
    } else {
      collapseInput();
    }
  }

  if ((e.ctrlKey || e.metaKey) && e.key === '/') {
    e.preventDefault();
    toggleShortcutsModal();
  }

  if (e.key === '?' && !isInputFocused) {
    e.preventDefault();
    toggleShortcutsModal();
  }

  if (e.key === "Escape") {
    if (shortcutsModal && !shortcutsModal.classList.contains("hidden")) {
      toggleShortcutsModal();
      return;
    }
    if (renameModal && !renameModal.classList.contains("hidden")) {
      closeRenameModal();
      return;
    }
    if (sandboxModal && !sandboxModal.classList.contains("hidden")) {
      closeSandbox();
      return;
    }
    if (settingsModal && !settingsModal.classList.contains("hidden")) {
      toggleSettings();
      return;
    }
    if (slashCommandsMenu && !slashCommandsMenu.classList.contains("hidden")) {
      slashCommandsMenu.classList.add("hidden");
      return;
    }
    if (document.activeElement === messageInput && !messageInput.value) {
      collapseInput();
    }
  }
});

function hideWelcomeScreen() {
  const welcomeScreen = document.getElementById("welcome-screen");
  if (welcomeScreen) welcomeScreen.style.display = 'none';
}

let lastMessageRole = null;

function appendMessage(role, text, fileInfo = null) {
  hideWelcomeScreen();
  
  const msgDiv = document.createElement("div");
  const isGrouped = lastMessageRole === role;
  const mtClass = isGrouped ? "mt-2" : "mt-6";
  msgDiv.className = `flex w-full animate-in fade-in slide-in-from-bottom-2 duration-300 ${role === 'user' ? 'justify-end' : 'justify-start'} ${mtClass}`;
  
  const innerBubble = document.createElement("div");
  let contentElement = innerBubble;
  
  if (role === 'user') {
    innerBubble.className = `w-fit max-w-[85%] sm:max-w-[75%] rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white px-5 py-3.5 shadow-md shadow-indigo-500/15 text-[15px] leading-relaxed whitespace-pre-wrap ${isGrouped ? 'rounded-tr-xl' : 'rounded-tr-sm'}`;
    
    // Display attached file or image
    if (fileInfo) {
      const isImg = (typeof fileInfo === 'string' && (fileInfo.startsWith('data:image') || fileInfo.startsWith('http'))) || 
                    (fileInfo && fileInfo.type === 'image');
      if (isImg) {
        const imgContainer = document.createElement("div");
        imgContainer.className = "mb-2 overflow-hidden rounded-xl border border-white/20 bg-black/10 max-w-sm shadow-sm";
        const imgEl = document.createElement("img");
        imgEl.src = typeof fileInfo === 'string' ? fileInfo : (fileInfo.dataUrl || "");
        imgEl.alt = "Uploaded image";
        imgEl.className = "max-h-64 w-auto rounded-xl object-contain cursor-pointer hover:opacity-95 transition-opacity";
        imgEl.onclick = () => window.open(imgEl.src, '_blank');
        imgContainer.appendChild(imgEl);
        innerBubble.appendChild(imgContainer);
      } else {
        const fileBadge = document.createElement("div");
        fileBadge.className = "mb-2 flex items-center gap-2 px-3 py-2 rounded-xl bg-white/10 border border-white/20 text-xs font-medium w-fit";
        const type = typeof fileInfo === 'object' ? fileInfo.type : 'file';
        const name = typeof fileInfo === 'object' ? fileInfo.name : 'Attached file';
        const iconName = type === 'audio' ? 'ph-speaker-simple-high' : (type === 'pdf' ? 'ph-file-pdf' : 'ph-file-code');
        fileBadge.innerHTML = `<i class="ph ${iconName} text-base"></i> <span class="truncate max-w-[200px]">${name}</span>`;
        innerBubble.appendChild(fileBadge);
      }
    }

    if (text && text !== "[Image attached]" && text !== "[File attached]") {
      const textDiv = document.createElement("div");
      textDiv.textContent = text;
      innerBubble.appendChild(textDiv);
    }
    
    msgDiv.appendChild(innerBubble);
  } else {
    // Dexter Message - Frameless and clean, just like ChatGPT/Claude
    const wrapperDiv = document.createElement("div");
    wrapperDiv.className = "flex gap-3.5 w-full";
    
    // Avatar
    const avatar = document.createElement("div");
    avatar.className = `w-8 h-8 rounded-xl overflow-hidden flex-shrink-0 mt-0.5 shadow-sm ring-1 ring-border/80 ${isGrouped ? 'invisible' : ''}`;
    avatar.innerHTML = '<img src="/logo.jpg" alt="Dexter" class="w-full h-full object-cover" />';
    
    const contentWrapper = document.createElement("div");
    contentWrapper.className = "flex flex-col gap-1 w-full min-w-0";

    innerBubble.className = "w-full text-foreground markdown-body overflow-x-auto leading-relaxed text-[15px] pt-0.5";
    
    const typingDotsHtml = `
      <div class="typing-indicator flex items-center gap-1.5 py-1">
        <span class="w-2 h-2 bg-indigo-500 rounded-full typing-dot inline-block"></span>
        <span class="w-2 h-2 bg-indigo-500 rounded-full typing-dot inline-block"></span>
        <span class="w-2 h-2 bg-indigo-500 rounded-full typing-dot inline-block"></span>
      </div>
    `;

    if (text) {
      innerBubble.innerHTML = marked.parse(text);
      postProcessContent(innerBubble);
      const words = text.trim() ? text.trim().split(/\s+/).filter(Boolean).length : 0;
      if (words > 0) {
        const readMins = Math.max(1, Math.ceil(words / 200));
        const badge = document.createElement("span");
        badge.className = "stats-badge text-[10px] text-muted-foreground/60 font-mono px-2 py-0.5 rounded-full bg-secondary/50 border border-border/40 select-none ml-1.5 flex items-center gap-1";
        badge.innerHTML = `<i class="ph ph-article text-xs"></i> <span>${words} words</span> · <span>~${readMins}m read</span>`;
        actionRow.appendChild(badge);
      }
    } else {
      innerBubble.innerHTML = typingDotsHtml;
    }
    
    contentElement = innerBubble;

    // Message Action Buttons with Text-to-Speech
    const actionRow = document.createElement("div");
    actionRow.className = "flex items-center gap-1 mt-1 ml-1 opacity-0 group-hover:opacity-100 transition-opacity flex-wrap";
    actionRow.innerHTML = `
      <button class="text-muted-foreground hover:text-foreground hover:bg-secondary/80 p-1.5 rounded-lg transition-colors tts-msg" title="Listen / Read Aloud">
        <i class="ph ph-speaker-high text-sm"></i>
      </button>
      <button class="text-muted-foreground hover:text-foreground hover:bg-secondary/80 p-1.5 rounded-lg transition-colors copy-msg" title="Copy Message">
        <i class="ph ph-copy text-sm"></i>
      </button>
      <button class="text-muted-foreground hover:text-foreground hover:bg-secondary/80 p-1.5 rounded-lg transition-colors regen-msg" title="Regenerate Response">
        <i class="ph ph-arrows-clockwise text-sm"></i>
      </button>
      <div class="h-3 w-px bg-border/60 mx-1"></div>
      <button class="text-muted-foreground hover:text-foreground hover:bg-secondary/80 p-1.5 rounded-lg transition-colors" title="Good Response">
        <i class="ph ph-thumbs-up text-sm"></i>
      </button>
      <button class="text-muted-foreground hover:text-foreground hover:bg-secondary/80 p-1.5 rounded-lg transition-colors" title="Bad Response">
        <i class="ph ph-thumbs-down text-sm"></i>
      </button>
    `;
    
    actionRow.querySelector('.tts-msg').addEventListener('click', function() {
      speakText(innerBubble.dataset.rawText || text || "", this);
    });

    actionRow.querySelector('.copy-msg').addEventListener('click', () => {
      navigator.clipboard.writeText(innerBubble.dataset.rawText || text || "");
    });

    actionRow.querySelector('.regen-msg').addEventListener('click', () => {
      if (lastUserMessage || lastUserFile) {
        msgDiv.remove();
        lastMessageRole = null;
        chatForm.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
      }
    });

    contentWrapper.appendChild(innerBubble);
    contentWrapper.appendChild(actionRow);

    wrapperDiv.appendChild(avatar);
    wrapperDiv.appendChild(contentWrapper);
    wrapperDiv.classList.add("group"); 
    msgDiv.appendChild(wrapperDiv);
  }
  
  messagesArea.appendChild(msgDiv);
  scrollToBottom();
  
  lastMessageRole = role;

  return {
    updateText: (newText) => {
      contentElement.dataset.rawText = newText;
      contentElement.innerHTML = marked.parse(newText) + `
        <div class="mt-2 text-indigo-500">
          <div class="typing-indicator flex items-center gap-1.5 py-1">
            <span class="w-2 h-2 bg-indigo-500 rounded-full typing-dot inline-block"></span>
            <span class="w-2 h-2 bg-indigo-500 rounded-full typing-dot inline-block"></span>
            <span class="w-2 h-2 bg-indigo-500 rounded-full typing-dot inline-block"></span>
          </div>
        </div>
      `;
      scrollToBottom();
    },
    finalize: () => {
      const rawText = contentElement.dataset.rawText || "";
      contentElement.innerHTML = marked.parse(rawText);
      postProcessContent(contentElement);

      // Append Response Stats Metric Badge
      const words = rawText.trim() ? rawText.trim().split(/\s+/).filter(Boolean).length : 0;
      if (words > 0) {
        const readMins = Math.max(1, Math.ceil(words / 200));
        const actionRow = contentElement.parentElement?.querySelector(".opacity-0") || contentElement.nextElementSibling;
        if (actionRow) {
          let badge = actionRow.querySelector(".stats-badge");
          if (!badge) {
            badge = document.createElement("span");
            badge.className = "stats-badge text-[10px] text-muted-foreground/60 font-mono px-2 py-0.5 rounded-full bg-secondary/50 border border-border/40 select-none ml-1.5 flex items-center gap-1";
            actionRow.appendChild(badge);
          }
          badge.innerHTML = `<i class="ph ph-article text-xs"></i> <span>${words} words</span> · <span>~${readMins}m read</span>`;
        }
      }

      scrollToBottom();
    }
  };
}

// KaTeX Math Renderer Helper
function renderKaTeX(element) {
  if (window.renderMathInElement) {
    try {
      window.renderMathInElement(element, {
        delimiters: [
          { left: "$$", right: "$$", display: true },
          { left: "$", right: "$", display: false },
          { left: "\\(", right: "\\)", display: false },
          { left: "\\[", right: "\\]", display: true }
        ],
        throwOnError: false
      });
    } catch (err) {
      console.warn("KaTeX render error:", err);
    }
  }
}

// Mermaid Diagram Renderer Helper
function renderMermaid(element) {
  if (!window.mermaid) return;
  try {
    mermaid.initialize({
      startOnLoad: false,
      theme: document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "default",
      securityLevel: "loose"
    });
    const mermaidCodeBlocks = element.querySelectorAll("pre code.language-mermaid");
    if (mermaidCodeBlocks.length === 0) return;
    mermaidCodeBlocks.forEach((codeEl, idx) => {
      const pre = codeEl.closest("pre");
      const rawCode = codeEl.innerText.trim();
      const container = document.createElement("div");
      container.className = "mermaid flex justify-center overflow-x-auto my-3 p-3 rounded-xl bg-secondary/40 border border-border/50";
      container.id = `mermaid-chart-${Date.now()}-${idx}`;
      container.textContent = rawCode;
      if (pre && pre.parentNode) {
        pre.parentNode.replaceChild(container, pre);
      }
    });
    mermaid.run({
      nodes: element.querySelectorAll(".mermaid")
    }).catch(err => {
      console.warn("Mermaid execution error:", err);
    });
  } catch (e) {
    console.warn("Mermaid error:", e);
  }
}

// Text-to-Speech Helper with Customized Voice & Rate
function speakText(rawText, btn = null) {
  if (!window.speechSynthesis) {
    alert("Speech synthesis is not supported in this browser.");
    return;
  }
  if (speechSynthesis.speaking) {
    speechSynthesis.cancel();
    if (btn && btn.dataset.speaking === "true") {
      btn.dataset.speaking = "false";
      btn.innerHTML = '<i class="ph ph-speaker-high text-sm"></i>';
      return;
    }
  }
  document.querySelectorAll('.tts-msg').forEach(b => {
    b.dataset.speaking = "false";
    b.innerHTML = '<i class="ph ph-speaker-high text-sm"></i>';
  });

  const clean = rawText
    .replace(/```[\s\S]*?```/g, "Code block omitted.")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/[*#_~\[\]]/g, "")
    .replace(/https?:\/\/\S+/g, "")
    .trim();

  if (!clean) return;

  const utterance = new SpeechSynthesisUtterance(clean);
  const savedVoiceUri = localStorage.getItem("dexter_tts_voice");
  if (savedVoiceUri) {
    const voices = speechSynthesis.getVoices();
    const voice = voices.find(v => v.voiceURI === savedVoiceUri);
    if (voice) utterance.voice = voice;
  }
  const savedRate = parseFloat(localStorage.getItem("dexter_tts_speed") || "1.0");
  utterance.rate = isNaN(savedRate) ? 1.0 : savedRate;

  if (btn) {
    btn.dataset.speaking = "true";
    btn.innerHTML = '<i class="ph ph-stop-circle text-sm text-indigo-500 animate-pulse"></i>';
    utterance.onend = () => {
      btn.dataset.speaking = "false";
      btn.innerHTML = '<i class="ph ph-speaker-high text-sm"></i>';
    };
    utterance.onerror = () => {
      btn.dataset.speaking = "false";
      btn.innerHTML = '<i class="ph ph-speaker-high text-sm"></i>';
    };
  }

  speechSynthesis.speak(utterance);
}

function postProcessContent(element) {
  // Syntax Highlighting & Code Preview
  element.querySelectorAll('pre code').forEach((block) => {
    if (block.classList.contains("language-mermaid")) return;
    hljs.highlightElement(block);
    const pre = block.parentElement;
    if (pre.querySelector('.copy-btn')) return;
    pre.classList.add("relative", "group");

    // Copy Code Button
    const copyBtn = document.createElement("button");
    copyBtn.className = "copy-btn absolute top-2 right-2 bg-secondary/80 text-secondary-foreground hover:bg-secondary p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity text-xs flex items-center gap-1 backdrop-blur-md";
    copyBtn.innerHTML = '<i class="ph ph-copy"></i> Copy';
    copyBtn.onclick = () => {
      navigator.clipboard.writeText(block.innerText);
      copyBtn.innerHTML = '<i class="ph ph-check text-green-500"></i> Copied';
      setTimeout(() => copyBtn.innerHTML = '<i class="ph ph-copy"></i> Copy', 2000);
    };
    pre.appendChild(copyBtn);

    // Live HTML / SVG Sandbox Preview Button
    const codeText = block.innerText;
    const isHtmlOrSvg = block.classList.contains("language-html") || 
                        block.classList.contains("language-xml") || 
                        block.classList.contains("language-svg") ||
                        codeText.includes("<!DOCTYPE html>") || 
                        codeText.includes("<html") || 
                        codeText.includes("<svg");

    if (isHtmlOrSvg) {
      const previewBtn = document.createElement("button");
      previewBtn.className = "preview-btn absolute top-2 right-20 bg-indigo-600 hover:bg-indigo-500 text-white px-2 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity text-xs flex items-center gap-1 font-semibold shadow-sm";
      previewBtn.innerHTML = '<i class="ph-bold ph-play"></i> Run';
      previewBtn.onclick = () => {
        openSandbox(codeText);
      };
      pre.appendChild(previewBtn);
    }
  });

  // KaTeX rendering
  renderKaTeX(element);

  // Mermaid diagrams
  renderMermaid(element);
}

function scrollToBottom() {
  chatContainer.scrollTo({
    top: chatContainer.scrollHeight,
    behavior: 'smooth'
  });
}

function showTypingIndicator() {
  hideWelcomeScreen();
  const div = document.createElement("div");
  div.id = "typing-indicator";
  div.className = "flex w-full justify-start animate-in fade-in duration-300";
  
  div.innerHTML = `
    <div class="flex gap-3.5 items-center">
      <div class="w-8 h-8 rounded-xl overflow-hidden flex-shrink-0 shadow-sm ring-1 ring-border/80">
        <img src="/logo.jpg" alt="Dexter" class="w-full h-full object-cover" />
      </div>
      <div class="flex items-center gap-1.5 py-2">
        <div class="w-2 h-2 bg-indigo-500 rounded-full typing-dot"></div>
        <div class="w-2 h-2 bg-indigo-500 rounded-full typing-dot"></div>
        <div class="w-2 h-2 bg-indigo-500 rounded-full typing-dot"></div>
      </div>
    </div>
  `;
  messagesArea.appendChild(div);
  scrollToBottom();
}

function removeTypingIndicator() {
  const div = document.getElementById("typing-indicator");
  if (div) {
    div.remove();
  }
}

// Suggestion Buttons Logic
document.querySelectorAll('.suggestion-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    let fullPrompt = btn.dataset.prompt;
    if (!fullPrompt) {
      const spans = btn.querySelectorAll('span');
      if (spans.length >= 3) {
        fullPrompt = `${spans[1].textContent.trim()} ${spans[2].textContent.trim()}`;
      } else if (spans.length >= 2) {
        fullPrompt = `${spans[0].textContent.trim()} ${spans[1].textContent.trim()}`;
      }
    }
    
    if (fullPrompt) {
      expandInput();
      messageInput.value = fullPrompt;
      messageInput.style.height = 'auto';
      messageInput.style.height = (messageInput.scrollHeight) + 'px';
      chatForm.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    }
  });
});

// ==========================================
// FIREBASE SESSIONS & HISTORY
// ==========================================
let currentSessionId = null;

function clearMessages() {
  lastMessageRole = null;
  activeSessionHistory = [];
  const children = Array.from(messagesArea.children);
  children.forEach(child => {
    if (child.id !== "welcome-screen") {
      child.remove();
    }
  });
  const welcomeScreen = document.getElementById("welcome-screen");
  if (welcomeScreen) welcomeScreen.style.display = 'flex';
}

function updateActiveSidebarClass() {
  const historyList = document.getElementById("chat-history-list");
  if (!historyList) return;
  const items = historyList.querySelectorAll("[data-session-id]");
  items.forEach(item => {
    const isCurrent = item.dataset.sessionId === currentSessionId;
    if (isCurrent) {
      item.classList.add("bg-secondary", "text-foreground", "shadow-sm", "border-border/80");
      item.classList.remove("text-muted-foreground", "border-transparent");
    } else {
      item.classList.remove("bg-secondary", "text-foreground", "shadow-sm", "border-border/80");
      item.classList.add("text-muted-foreground", "border-transparent");
    }
  });
}

async function createNewSession(firstMessageText) {
  if (!currentSessionId) {
    currentSessionId = crypto.randomUUID();
  }
  const cleanTitle = (firstMessageText || "New Chat").replace(/[\r\n]+/g, " ").trim();
  const title = cleanTitle.length > 28 ? cleanTitle.substring(0, 28) + "..." : cleanTitle;
  try {
    await setDoc(doc(db, "sessions", currentSessionId), {
      title: title || "New Chat",
      createdAt: serverTimestamp(),
      isPinned: false
    });
  } catch (error) {
    console.error("Error creating session:", error);
  }
}

async function saveMessageToFirestore(role, message, image = null) {
  if (!currentSessionId) {
    await createNewSession(message || "Image Query");
  }
  try {
    const docData = {
      role: role,
      message: message || "",
      timestamp: serverTimestamp()
    };
    if (image && image.length < 800000) {
      docData.image = image;
    }
    await addDoc(collection(db, "sessions", currentSessionId, "messages"), docData);
  } catch (error) {
    console.warn("Error saving message: ", error);
  }
}

async function loadChatHistory(sessionId) {
  clearMessages();
  currentSessionId = sessionId;
  updateActiveSidebarClass();
  activeSessionHistory = [];
  try {
    const q = query(collection(db, "sessions", sessionId, "messages"), orderBy("timestamp", "asc"));
    const querySnapshot = await getDocs(q);
    
    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      appendMessage(data.role, data.message, data.image);
      if (data.message) {
        activeSessionHistory.push({
          role: data.role === 'dexter' ? 'model' : 'user',
          parts: [{ text: data.message }]
        });
      }
    });
  } catch (error) {
    console.warn("Error loading chat history: ", error);
  }
}

function renderSidebarSessions(querySnapshot) {
  const historyList = document.getElementById("chat-history-list");
  if (!historyList) return;
  historyList.innerHTML = '';
  
  if (querySnapshot.empty) {
    historyList.innerHTML = `
      <div class="text-[11px] font-bold text-muted-foreground/70 px-2.5 py-2 uppercase tracking-wider">Recent</div>
      <div class="text-xs text-muted-foreground/60 px-3 py-3 italic">No previous chats</div>
    `;
    return;
  }
  
  const pinnedSessions = [];
  const recentSessions = [];

  querySnapshot.forEach((docSnap) => {
    const session = docSnap.data();
    session.id = docSnap.id;
    if (session.isPinned) {
      pinnedSessions.push(session);
    } else {
      recentSessions.push(session);
    }
  });

  function createSessionItem(session) {
    const sessionId = session.id;
    const isCurrent = currentSessionId === sessionId;
    
    const container = document.createElement("div");
    container.dataset.sessionId = sessionId;
    container.className = `group flex items-center justify-between w-full px-2.5 py-1.5 rounded-xl text-sm font-medium border transition-all ${isCurrent ? 'bg-secondary text-foreground shadow-sm border-border/80' : 'text-muted-foreground border-transparent hover:bg-secondary/60 hover:text-foreground'}`;
    
    const titleBtn = document.createElement("button");
    titleBtn.className = "flex-1 text-left truncate flex items-center gap-2 py-1 min-w-0";
    titleBtn.innerHTML = `<i class="ph ph-chat-circle text-muted-foreground flex-shrink-0 text-base"></i><span class="truncate">${session.title || "New Chat"}</span>`;
    titleBtn.addEventListener("click", () => {
      if (currentSessionId !== sessionId) {
        loadChatHistory(sessionId);
      }
      if (window.innerWidth < 768) toggleSidebar();
    });
    
    const actionsWrapper = document.createElement("div");
    actionsWrapper.className = "flex items-center gap-0.5 ml-1 flex-shrink-0";

    // Pin Button
    const pinBtn = document.createElement("button");
    pinBtn.className = `p-1 rounded-lg hover:bg-secondary/80 ${session.isPinned ? 'text-amber-500' : 'text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-amber-500'} transition-all`;
    pinBtn.title = session.isPinned ? "Unpin chat" : "Pin to top";
    pinBtn.innerHTML = `<i class="${session.isPinned ? 'ph-fill ph-star' : 'ph ph-star'} text-xs"></i>`;
    pinBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      try {
        await updateDoc(doc(db, "sessions", sessionId), {
          isPinned: !session.isPinned
        });
      } catch (err) {
        console.error("Error toggling pin:", err);
      }
    });

    // Rename Button
    const renameBtn = document.createElement("button");
    renameBtn.className = "opacity-0 group-hover:opacity-100 hover:text-foreground hover:bg-secondary/80 p-1 rounded-lg transition-all text-muted-foreground";
    renameBtn.title = "Rename Chat";
    renameBtn.innerHTML = '<i class="ph ph-pencil-simple text-xs"></i>';
    renameBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      openRenameModal(sessionId, session.title || "New Chat");
    });

    // Delete Button
    const deleteBtn = document.createElement("button");
    deleteBtn.className = "opacity-0 group-hover:opacity-100 hover:text-destructive hover:bg-destructive/10 p-1 rounded-lg transition-all text-muted-foreground";
    deleteBtn.title = "Delete Chat";
    deleteBtn.innerHTML = '<i class="ph ph-trash text-xs"></i>';
    deleteBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      if (confirm(`Delete "${session.title || "this chat"}"?`)) {
        try {
          await deleteDoc(doc(db, "sessions", sessionId));
          if (currentSessionId === sessionId) {
            currentSessionId = null;
            clearMessages();
          }
        } catch (err) {
          console.error("Error deleting session:", err);
        }
      }
    });

    actionsWrapper.appendChild(pinBtn);
    actionsWrapper.appendChild(renameBtn);
    actionsWrapper.appendChild(deleteBtn);

    container.appendChild(titleBtn);
    container.appendChild(actionsWrapper);
    return container;
  }

  // Render Pinned section if any
  if (pinnedSessions.length > 0) {
    const pinnedHeader = document.createElement("div");
    pinnedHeader.className = "text-[11px] font-bold text-amber-500/90 px-2.5 py-1.5 uppercase tracking-wider flex items-center gap-1.5";
    pinnedHeader.innerHTML = '<i class="ph-fill ph-star text-xs"></i> Pinned';
    historyList.appendChild(pinnedHeader);

    pinnedSessions.forEach(session => {
      historyList.appendChild(createSessionItem(session));
    });
  }

  // Render Recent section
  const recentHeader = document.createElement("div");
  recentHeader.className = `text-[11px] font-bold text-muted-foreground/70 px-2.5 py-1.5 uppercase tracking-wider ${pinnedSessions.length > 0 ? 'mt-2' : ''}`;
  recentHeader.textContent = "Recent";
  historyList.appendChild(recentHeader);

  if (recentSessions.length === 0 && pinnedSessions.length > 0) {
    const emptyRecent = document.createElement("div");
    emptyRecent.className = "text-xs text-muted-foreground/60 px-3 py-1.5 italic";
    emptyRecent.textContent = "All chats pinned";
    historyList.appendChild(emptyRecent);
  } else {
    recentSessions.forEach(session => {
      historyList.appendChild(createSessionItem(session));
    });
  }
}

function initSidebarSessionsListener() {
  try {
    const q = query(collection(db, "sessions"), orderBy("createdAt", "desc"));
    onSnapshot(q, (snapshot) => {
      renderSidebarSessions(snapshot);
      dismissLoadingScreen();
    }, (error) => {
      console.warn("Real-time sessions listener error:", error);
      dismissLoadingScreen();
    });
  } catch (error) {
    console.warn("Error setting up sessions listener:", error);
    dismissLoadingScreen();
  }
}

function dismissLoadingScreen() {
  const loadingScreen = document.getElementById("loading-screen");
  if (loadingScreen && !loadingScreen.classList.contains("fade-out")) {
    setTimeout(() => {
      loadingScreen.classList.add("fade-out");
      setTimeout(() => loadingScreen.remove(), 800);
    }, 1200);
  }
}

const newChatBtn = document.getElementById("new-chat-btn");
if (newChatBtn) {
  newChatBtn.addEventListener("click", () => {
    currentSessionId = null;
    clearMessages();
    updateActiveSidebarClass();
    if (window.innerWidth < 768) toggleSidebar();
  });
}

// ==========================================
// GEMINI API CALL WITH PERSONAS, SEARCH & MEMORY
// ==========================================
function getActiveModel() {
  let personaInstruction = PERSONAS[currentPersona] || PERSONAS.default;
  const customInstructions = localStorage.getItem("dexter_custom_instructions") || "";
  if (customInstructions.trim()) {
    personaInstruction += `\n\nUser Custom Preferences & Instructions:\n${customInstructions.trim()}`;
  }
  const config = {
    model: "gemini-2.5-flash",
    systemInstruction: personaInstruction
  };
  if (isWebSearchEnabled) {
    config.tools = [{ googleSearch: {} }];
  }
  return genAI.getGenerativeModel(config);
}

async function streamDexterResponse(prompt, attachedFile, uiUpdater) {
  if (!GEMINI_API_KEY) {
    const errorText = "**Configuration Error:** Gemini API key is missing. Please set `VITE_GEMINI_API_KEY` in your environment variables (or Vercel dashboard).";
    uiUpdater.updateText(errorText);
    uiUpdater.finalize();
    return errorText;
  }

  let activeModel = getActiveModel();

  try {
    let result;
    if (attachedFile) {
      if (attachedFile.base64Data && attachedFile.mimeType) {
        // Multimodal: image, audio, or PDF
        const filePart = {
          inlineData: {
            data: attachedFile.base64Data,
            mimeType: attachedFile.mimeType
          }
        };
        const promptToUse = prompt || `Please analyze this attached ${attachedFile.type}.`;
        try {
          result = await activeModel.generateContentStream([promptToUse, filePart]);
        } catch (callErr) {
          if (isWebSearchEnabled) {
            console.warn("Retrying without search grounding:", callErr);
            const fallbackModel = genAI.getGenerativeModel({
              model: "gemini-2.5-flash",
              systemInstruction: PERSONAS[currentPersona] || PERSONAS.default
            });
            result = await fallbackModel.generateContentStream([promptToUse, filePart]);
          } else {
            throw callErr;
          }
        }
      } else if (attachedFile.textContent) {
        // Text / code / CSV / JSON document
        const fullPrompt = `Attached file "${attachedFile.name}":\n\`\`\`\n${attachedFile.textContent}\n\`\`\`\n\nUser request: ${prompt || "Please review or analyze this attached document."}`;
        try {
          result = await activeModel.generateContentStream(fullPrompt);
        } catch (callErr) {
          if (isWebSearchEnabled) {
            const fallbackModel = genAI.getGenerativeModel({
              model: "gemini-2.5-flash",
              systemInstruction: PERSONAS[currentPersona] || PERSONAS.default
            });
            result = await fallbackModel.generateContentStream(fullPrompt);
          } else {
            throw callErr;
          }
        }
      }
    } else {
      if (!prompt) return "";

      // Multi-turn conversation context
      let usedChatSession = false;
      if (activeSessionHistory.length > 0 && !isWebSearchEnabled) {
        try {
          const validHistory = [];
          let expectedRole = 'user';
          for (const turn of activeSessionHistory.slice(-8)) {
            if (turn.role === expectedRole && turn.parts?.[0]?.text) {
              validHistory.push(turn);
              expectedRole = expectedRole === 'user' ? 'model' : 'user';
            }
          }
          if (validHistory.length > 0 && validHistory[validHistory.length - 1].role === 'user') {
            validHistory.pop();
          }

          if (validHistory.length >= 2) {
            const chatSession = activeModel.startChat({ history: validHistory });
            result = await chatSession.sendMessageStream(prompt);
            usedChatSession = true;
          }
        } catch (chatErr) {
          console.warn("Falling back from startChat to generateContentStream:", chatErr);
        }
      }

      if (!usedChatSession) {
        try {
          result = await activeModel.generateContentStream(prompt);
        } catch (callErr) {
          if (isWebSearchEnabled) {
            const fallbackModel = genAI.getGenerativeModel({
              model: "gemini-2.5-flash",
              systemInstruction: PERSONAS[currentPersona] || PERSONAS.default
            });
            result = await fallbackModel.generateContentStream(prompt);
          } else {
            throw callErr;
          }
        }
      }
    }
    
    let fullText = "";
    for await (const chunk of result.stream) {
      const chunkText = chunk.text();
      fullText += chunkText;
      uiUpdater.updateText(fullText);
    }
    
    uiUpdater.finalize();

    // Save into multi-turn memory
    if (prompt) {
      activeSessionHistory.push({ role: 'user', parts: [{ text: prompt }] });
    }
    if (fullText) {
      activeSessionHistory.push({ role: 'model', parts: [{ text: fullText }] });
    }

    return fullText;
  } catch (error) {
    console.error("Error calling Gemini API: ", error);
    const errorText = `**Error:** ${error.message || error.toString()}`;
    uiUpdater.updateText(errorText);
    uiUpdater.finalize();
    return errorText;
  }
}

// ==========================================
// FORM SUBMISSION
// ==========================================
chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  
  let text = messageInput.value.trim();
  const fileToSubmit = currentAttachedFile;
  
  if (!text && !fileToSubmit && !lastUserMessage && !lastUserFile) return; 

  let displayMessage = text;
  let fileDataToDisplay = fileToSubmit;
  
  if (text || fileToSubmit) {
    appendMessage("user", displayMessage, fileDataToDisplay);
    saveMessageToFirestore("user", displayMessage, fileDataToDisplay ? (fileDataToDisplay.dataUrl || fileDataToDisplay.name) : null);
    lastUserMessage = text; 
    lastUserFile = fileToSubmit;
  } else {
    // Regenerating
    text = lastUserMessage;
    fileDataToDisplay = lastUserFile;
  }

  const promptText = text;
  
  messageInput.value = "";
  messageInput.style.height = 'auto';
  clearAttachedFile();
  sendButton.disabled = true;
  if (voiceButton) voiceButton.disabled = true;
  
  // Create an empty Dexter message bubble with waving typing dots!
  const updater = appendMessage("dexter", null);
  
  const aiResponse = await streamDexterResponse(promptText, fileDataToDisplay, updater);
  
  saveMessageToFirestore("dexter", aiResponse);
  
  sendButton.disabled = false;
  if (voiceButton) voiceButton.disabled = false;
});


window.addEventListener("DOMContentLoaded", () => {
  initSidebarSessionsListener();
  
  
  setTimeout(() => {
    const loadingScreen = document.getElementById("loading-screen");
    if (loadingScreen && !loadingScreen.classList.contains("fade-out")) {
      loadingScreen.classList.add("fade-out");
      setTimeout(() => loadingScreen.remove(), 800);
    }
  }, 3500);
});
