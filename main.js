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
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });


const messagesArea = document.getElementById("messages-area");
const chatForm = document.getElementById("chat-form");
const messageInput = document.getElementById("message-input");
const imageUpload = document.getElementById("image-upload");
const imagePreviewContainer = document.getElementById("image-preview-container");
const imagePreview = document.getElementById("image-preview");
const removeImageBtn = document.getElementById("remove-image");
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


let currentBase64Image = null;
let currentMimeType = null;
let currentFullImageDataUrl = null;
let lastUserMessage = "";
let lastUserImage = null;
let lastUserMimeType = null;
let lastUserFullImageDataUrl = null;
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


imageUpload.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result;
      imagePreview.src = base64String;
      imagePreviewContainer.classList.remove("hidden");
      
      const base64Data = base64String.split(",")[1];
      currentBase64Image = base64Data;
      currentMimeType = file.type;
      currentFullImageDataUrl = base64String;
    };
    reader.readAsDataURL(file);
  }
});

removeImageBtn.addEventListener("click", clearImagePreview);

function clearImagePreview() {
  imageUpload.value = "";
  imagePreview.src = "";
  imagePreviewContainer.classList.add("hidden");
  currentBase64Image = null;
  currentMimeType = null;
  currentFullImageDataUrl = null;
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

function hideWelcomeScreen() {
  const welcomeScreen = document.getElementById("welcome-screen");
  if (welcomeScreen) welcomeScreen.style.display = 'none';
}

let lastMessageRole = null;

function appendMessage(role, text, imageUrl = null) {
  hideWelcomeScreen();
  
  const msgDiv = document.createElement("div");
  // Check if we should group this message
  const isGrouped = lastMessageRole === role;
  const mtClass = isGrouped ? "mt-2" : "mt-6";
  msgDiv.className = `flex w-full animate-in fade-in slide-in-from-bottom-2 duration-300 ${role === 'user' ? 'justify-end' : 'justify-start'} ${mtClass}`;
  
  const innerBubble = document.createElement("div");
  let contentElement = innerBubble; // The element where text will be injected
  
  if (role === 'user') {
    innerBubble.className = `w-fit max-w-[85%] sm:max-w-[75%] rounded-2xl bg-primary text-primary-foreground px-5 py-3 shadow-sm text-[15px] leading-relaxed whitespace-pre-wrap ${isGrouped ? 'rounded-tr-xl' : 'rounded-tr-sm'}`;
    
    // Display uploaded photo in user message
    if (imageUrl) {
      const imgContainer = document.createElement("div");
      imgContainer.className = "mb-2 overflow-hidden rounded-xl border border-white/20 bg-black/10 max-w-sm";
      const imgEl = document.createElement("img");
      imgEl.src = imageUrl;
      imgEl.alt = "Uploaded image";
      imgEl.className = "max-h-64 w-auto rounded-xl object-contain cursor-pointer hover:opacity-95 transition-opacity";
      imgEl.onclick = () => window.open(imageUrl, '_blank');
      imgContainer.appendChild(imgEl);
      innerBubble.appendChild(imgContainer);
    }

    if (text && text !== "[Image attached]") {
      const textDiv = document.createElement("div");
      textDiv.textContent = text;
      innerBubble.appendChild(textDiv);
    }
    
    msgDiv.appendChild(innerBubble);
  } else {
    // Dexter Message
    const wrapperDiv = document.createElement("div");
    wrapperDiv.className = "flex gap-3 max-w-[95%] sm:max-w-[85%]";
    
    // Avatar
    const avatar = document.createElement("div");
    avatar.className = `w-8 h-8 rounded-full overflow-hidden flex-shrink-0 mt-1 shadow-sm ring-1 ring-border ${isGrouped ? 'invisible' : ''}`;
    avatar.innerHTML = '<img src="/logo.jpg" alt="Dexter" class="w-full h-full object-cover" />';
    
    const contentWrapper = document.createElement("div");
    contentWrapper.className = "flex flex-col gap-1 w-full min-w-0";

    innerBubble.className = `w-fit rounded-2xl bg-card border border-border text-card-foreground px-5 py-4 shadow-sm markdown-body overflow-x-auto ${isGrouped ? 'rounded-tl-xl' : 'rounded-tl-sm'}`;
    
    const typingDotsHtml = `
      <div class="typing-indicator flex items-center gap-1.5 py-1">
        <span class="w-2 h-2 bg-muted-foreground rounded-full typing-dot inline-block"></span>
        <span class="w-2 h-2 bg-muted-foreground rounded-full typing-dot inline-block"></span>
        <span class="w-2 h-2 bg-muted-foreground rounded-full typing-dot inline-block"></span>
      </div>
    `;

    if (text) {
      innerBubble.innerHTML = marked.parse(text);
      applySyntaxHighlighting(innerBubble);
    } else {
      // Waving dots while waiting or generating!
      innerBubble.innerHTML = typingDotsHtml;
    }
    
    contentElement = innerBubble;

    // Message Action Buttons
    const actionRow = document.createElement("div");
    actionRow.className = "flex items-center gap-2 mt-1 ml-2 opacity-0 group-hover:opacity-100 transition-opacity";
    actionRow.innerHTML = `
      <button class="text-muted-foreground hover:text-foreground hover:bg-secondary p-1.5 rounded-full transition-colors copy-msg" title="Copy Message">
        <i class="ph ph-copy text-sm"></i>
      </button>
      <button class="text-muted-foreground hover:text-foreground hover:bg-secondary p-1.5 rounded-full transition-colors regen-msg" title="Regenerate Response">
        <i class="ph ph-arrows-clockwise text-sm"></i>
      </button>
      <div class="h-3 w-px bg-border mx-1"></div>
      <button class="text-muted-foreground hover:text-foreground hover:bg-secondary p-1.5 rounded-full transition-colors" title="Good Response">
        <i class="ph ph-thumbs-up text-sm"></i>
      </button>
      <button class="text-muted-foreground hover:text-foreground hover:bg-secondary p-1.5 rounded-full transition-colors" title="Bad Response">
        <i class="ph ph-thumbs-down text-sm"></i>
      </button>
    `;
    
    actionRow.querySelector('.copy-msg').addEventListener('click', () => {
      navigator.clipboard.writeText(innerBubble.dataset.rawText || text || "");
    });

    actionRow.querySelector('.regen-msg').addEventListener('click', () => {
      if (lastUserMessage || lastUserImage) {
        msgDiv.remove();
        lastMessageRole = null; // reset grouping for regen
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

  // Return a controller for streaming updates with waving dots while generating
  return {
    updateText: (newText) => {
      contentElement.dataset.rawText = newText;
      contentElement.innerHTML = marked.parse(newText) + `
        <div class="mt-2 text-muted-foreground">
          <div class="typing-indicator flex items-center gap-1.5 py-1">
            <span class="w-2 h-2 bg-muted-foreground rounded-full typing-dot inline-block"></span>
            <span class="w-2 h-2 bg-muted-foreground rounded-full typing-dot inline-block"></span>
            <span class="w-2 h-2 bg-muted-foreground rounded-full typing-dot inline-block"></span>
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

function applySyntaxHighlighting(element) {
  element.querySelectorAll('pre code').forEach((block) => {
    hljs.highlightElement(block);
    const pre = block.parentElement;
    if (pre.querySelector('.copy-btn')) return; // already added
    pre.classList.add("relative", "group");
    const copyBtn = document.createElement("button");
    copyBtn.className = "copy-btn absolute top-2 right-2 bg-secondary/80 text-secondary-foreground hover:bg-secondary p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity text-xs flex items-center gap-1 backdrop-blur-md";
    copyBtn.innerHTML = '<i class="ph ph-copy"></i> Copy';
    copyBtn.onclick = () => {
      navigator.clipboard.writeText(block.innerText);
      copyBtn.innerHTML = '<i class="ph ph-check text-green-500"></i> Copied';
      setTimeout(() => copyBtn.innerHTML = '<i class="ph ph-copy"></i> Copy', 2000);
    };
    pre.appendChild(copyBtn);
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
    <div class="flex gap-3 max-w-[85%]">
      <div class="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0 mt-1 shadow-sm border border-border">
        <img src="/logo.jpg" alt="Dexter" class="w-full h-full object-cover" />
      </div>
      <div class="rounded-2xl rounded-tl-sm bg-card border border-border px-5 py-4 shadow-sm flex items-center gap-1.5 h-12">
        <div class="w-2 h-2 bg-muted-foreground rounded-full typing-dot"></div>
        <div class="w-2 h-2 bg-muted-foreground rounded-full typing-dot"></div>
        <div class="w-2 h-2 bg-muted-foreground rounded-full typing-dot"></div>
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
    const spans = btn.querySelectorAll('span');
    if (spans.length >= 2) {
      const fullPrompt = `${spans[0].textContent} ${spans[1].textContent}`;
      
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
      item.classList.add("bg-secondary", "text-foreground");
      item.classList.remove("text-muted-foreground");
    } else {
      item.classList.remove("bg-secondary", "text-foreground");
      item.classList.add("text-muted-foreground");
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
  historyList.innerHTML = '<div class="text-xs font-semibold text-muted-foreground px-2 py-2 uppercase tracking-wider">Recent</div>';
  
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
    container.className = `group flex items-center justify-between w-full px-2.5 py-1.5 rounded-xl text-sm font-medium transition-colors ${currentSessionId === sessionId ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground'}`;
    
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
// GEMINI API CALL
// ==========================================
async function streamDexterResponse(prompt, base64Image, mimeType, uiUpdater) {
  if (!GEMINI_API_KEY) {
    const errorText = "**Configuration Error:** Gemini API key is missing. Please set `VITE_GEMINI_API_KEY` in your environment variables (or Vercel dashboard).";
    uiUpdater.updateText(errorText);
    uiUpdater.finalize();
    return errorText;
  }
  try {
    let result;
    if (base64Image && mimeType) {
      const imagePart = {
        inlineData: {
          data: base64Image,
          mimeType: mimeType
        }
      };
      const promptToUse = prompt || "Please describe this image.";
      result = await model.generateContentStream([promptToUse, imagePart]);
    } else {
      if (!prompt) return "";
      result = await model.generateContentStream(prompt);
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
  const hasImage = !!currentBase64Image;
  
  if (!text && !hasImage && !lastUserMessage && !lastUserImage) return; 

  let displayMessage = text;
  let imageToDisplay = currentFullImageDataUrl;
  let imgData = currentBase64Image;
  let mimeData = currentMimeType;
  
  if (text || hasImage) {
    appendMessage("user", displayMessage, imageToDisplay);
    saveMessageToFirestore("user", displayMessage, imageToDisplay);
    lastUserMessage = text; 
    lastUserImage = currentBase64Image;
    lastUserMimeType = currentMimeType;
    lastUserFullImageDataUrl = currentFullImageDataUrl;
  } else {
    // Regenerating
    text = lastUserMessage;
    imgData = lastUserImage;
    mimeData = lastUserMimeType;
  }

  const promptText = text;
  
  messageInput.value = "";
  messageInput.style.height = 'auto';
  clearImagePreview();
  sendButton.disabled = true;
  if(voiceButton) voiceButton.disabled = true;
  
  // Create an empty Dexter message bubble with waving typing dots!
  const updater = appendMessage("dexter", null);
  
  const aiResponse = await streamDexterResponse(promptText, imgData, mimeData, updater);
  
  saveMessageToFirestore("dexter", aiResponse);
  
  sendButton.disabled = false;
  if(voiceButton) voiceButton.disabled = false;
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
