import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, query, orderBy, serverTimestamp, getDocs, doc, setDoc, writeBatch, onSnapshot, deleteDoc } from "firebase/firestore";
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

let currentAttachedFile = null;
let lastUserMessage = "";
let lastUserFile = null;
let isRecording = false;


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
if (fileUpload) {
  fileUpload.addEventListener("change", (e) => {
    const file = e.target.files[0];
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
      };
      reader.readAsText(file);
    } else {
      alert("Unsupported file format. Please attach images, audio, PDF, or code/text files.");
    }
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


messageInput.addEventListener('input', function() {
  this.style.height = 'auto';
  this.style.height = (this.scrollHeight) + 'px';
  if(this.value === '') this.style.height = 'auto';
});

messageInput.addEventListener('keydown', function(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    if (!sendButton.disabled && (messageInput.value.trim() || currentBase64Image)) {
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
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    if (chatForm.classList.contains("hidden")) {
      expandInput();
    } else {
      collapseInput();
    }
  }
  if (e.key === "Escape" && document.activeElement === messageInput && !messageInput.value) {
    collapseInput();
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
    // Dexter Message
    const wrapperDiv = document.createElement("div");
    wrapperDiv.className = "flex gap-3.5 max-w-[95%] sm:max-w-[85%]";
    
    // Avatar
    const avatar = document.createElement("div");
    avatar.className = `w-8 h-8 rounded-xl overflow-hidden flex-shrink-0 mt-1 shadow-sm ring-1 ring-border/80 ${isGrouped ? 'invisible' : ''}`;
    avatar.innerHTML = '<img src="/logo.jpg" alt="Dexter" class="w-full h-full object-cover" />';
    
    const contentWrapper = document.createElement("div");
    contentWrapper.className = "flex flex-col gap-1.5 w-full min-w-0";

    innerBubble.className = `w-fit rounded-2xl bg-card/90 backdrop-blur-md border border-border/80 text-card-foreground px-5 py-4 shadow-sm markdown-body overflow-x-auto ${isGrouped ? 'rounded-tl-xl' : 'rounded-tl-sm'}`;
    
    const typingDotsHtml = `
      <div class="typing-indicator flex items-center gap-1.5 py-1">
        <span class="w-2 h-2 bg-indigo-500 rounded-full typing-dot inline-block"></span>
        <span class="w-2 h-2 bg-indigo-500 rounded-full typing-dot inline-block"></span>
        <span class="w-2 h-2 bg-indigo-500 rounded-full typing-dot inline-block"></span>
      </div>
    `;

    if (text) {
      innerBubble.innerHTML = marked.parse(text);
      applySyntaxHighlighting(innerBubble);
    } else {
      innerBubble.innerHTML = typingDotsHtml;
    }
    
    contentElement = innerBubble;

    // Message Action Buttons with Text-to-Speech
    const actionRow = document.createElement("div");
    actionRow.className = "flex items-center gap-1 mt-1 ml-1 opacity-0 group-hover:opacity-100 transition-opacity";
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
      contentElement.innerHTML = marked.parse(contentElement.dataset.rawText || "");
      applySyntaxHighlighting(contentElement);
      scrollToBottom();
    }
  };
}

// Text-to-Speech Helper
function speakText(rawText, btn) {
  if (!window.speechSynthesis) {
    alert("Speech synthesis is not supported in this browser.");
    return;
  }
  if (speechSynthesis.speaking) {
    speechSynthesis.cancel();
    if (btn.dataset.speaking === "true") {
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

  speechSynthesis.speak(utterance);
}

function applySyntaxHighlighting(element) {
  element.querySelectorAll('pre code').forEach((block) => {
    hljs.highlightElement(block);
    const pre = block.parentElement;
    if (pre.querySelector('.copy-btn')) return; // already added
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
    <div class="flex gap-3.5 max-w-[85%]">
      <div class="w-8 h-8 rounded-xl overflow-hidden flex-shrink-0 mt-1 shadow-sm border border-border/80">
        <img src="/logo.jpg" alt="Dexter" class="w-full h-full object-cover" />
      </div>
      <div class="rounded-2xl rounded-tl-sm bg-card/90 backdrop-blur-md border border-border/80 px-5 py-4 shadow-sm flex items-center gap-1.5 h-12">
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
      createdAt: serverTimestamp()
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
  try {
    const q = query(collection(db, "sessions", sessionId, "messages"), orderBy("timestamp", "asc"));
    const querySnapshot = await getDocs(q);
    
    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      appendMessage(data.role, data.message, data.image);
    });
  } catch (error) {
    console.warn("Error loading chat history: ", error);
  }
}

function renderSidebarSessions(querySnapshot) {
  const historyList = document.getElementById("chat-history-list");
  if (!historyList) return;
  historyList.innerHTML = '<div class="text-[11px] font-bold text-muted-foreground/70 px-2.5 py-2 uppercase tracking-wider">Recent</div>';
  
  if (querySnapshot.empty) {
    const emptyNotice = document.createElement("div");
    emptyNotice.className = "text-xs text-muted-foreground/60 px-3 py-3 italic";
    emptyNotice.textContent = "No previous chats";
    historyList.appendChild(emptyNotice);
    return;
  }
  
  querySnapshot.forEach((docSnap) => {
    const session = docSnap.data();
    const sessionId = docSnap.id;
    
    const container = document.createElement("div");
    container.dataset.sessionId = sessionId;
    container.className = `group flex items-center justify-between w-full px-2.5 py-1.5 rounded-xl text-sm font-medium border transition-all ${currentSessionId === sessionId ? 'bg-secondary text-foreground shadow-sm border-border/80' : 'text-muted-foreground border-transparent hover:bg-secondary/60 hover:text-foreground'}`;
    
    const titleBtn = document.createElement("button");
    titleBtn.className = "flex-1 text-left truncate flex items-center gap-2 py-1 min-w-0";
    titleBtn.innerHTML = `<i class="ph ph-chat-circle text-muted-foreground flex-shrink-0 text-base"></i><span class="truncate">${session.title || "New Chat"}</span>`;
    titleBtn.addEventListener("click", () => {
      if (currentSessionId !== sessionId) {
        loadChatHistory(sessionId);
      }
      if (window.innerWidth < 768) toggleSidebar();
    });
    
    const deleteBtn = document.createElement("button");
    deleteBtn.className = "opacity-0 group-hover:opacity-100 hover:text-destructive hover:bg-destructive/10 p-1.5 rounded-lg transition-all ml-1 flex-shrink-0";
    deleteBtn.title = "Delete Chat";
    deleteBtn.innerHTML = '<i class="ph ph-trash text-sm"></i>';
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
    
    container.appendChild(titleBtn);
    container.appendChild(deleteBtn);
    historyList.appendChild(container);
  });
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
// GEMINI API CALL WITH PERSONAS & SEARCH
// ==========================================
function getActiveModel() {
  const personaInstruction = PERSONAS[currentPersona] || PERSONAS.default;
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
    
    let fullText = "";
    for await (const chunk of result.stream) {
      const chunkText = chunk.text();
      fullText += chunkText;
      uiUpdater.updateText(fullText);
    }
    
    uiUpdater.finalize();
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
