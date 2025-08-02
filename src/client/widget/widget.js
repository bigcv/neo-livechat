// Neo LiveChat Widget
(function() {
  'use strict';

  // Widget configuration
  const config = {
    apiUrl: window.NeoLiveChatConfig?.apiUrl || 'http://localhost:3000',
    wsUrl: window.NeoLiveChatConfig?.wsUrl || 'ws://localhost:3000/ws',
    customerId: window.NeoLiveChatConfig?.customerId || 'demo',
    position: window.NeoLiveChatConfig?.position || 'bottom-right',
    primaryColor: window.NeoLiveChatConfig?.primaryColor || '#0066cc',
    greeting: window.NeoLiveChatConfig?.greeting || 'Hi! How can I help you today?'
  };

  // Widget state
  let isOpen = false;
  let ws = null;
  let sessionId = null;
  let messages = [];
  let reconnectAttempts = 0;

  // Create widget HTML
  function createWidgetHTML() {
    const widgetHTML = `
      <div id="neo-livechat-widget" class="neo-widget-container neo-${config.position}">
        <!-- Chat Button -->
        <button id="neo-chat-button" class="neo-chat-button" aria-label="Open chat">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M12 2C6.48 2 2 6.48 2 12C2 13.85 2.51 15.58 3.39 17.06L2 22L6.94 20.61C8.42 21.49 10.15 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM8 11C8.55 11 9 11.45 9 12C9 12.55 8.55 13 8 13C7.45 13 7 12.55 7 12C7 11.45 7.45 11 8 11ZM16 13C15.45 13 15 12.55 15 12C15 11.45 15.45 11 16 11C16.55 11 17 11.45 17 12C17 12.55 16.55 13 16 13ZM12 13C11.45 13 11 12.55 11 12C11 11.45 11.45 11 12 11C12.55 11 13 11.45 13 12C13 12.55 12.55 13 12 13Z" fill="white"/>
          </svg>
          <span class="neo-unread-indicator" style="display: none;">1</span>
        </button>

        <!-- Chat Window -->
        <div id="neo-chat-window" class="neo-chat-window" style="display: none;">
          <!-- Header -->
          <div class="neo-chat-header">
            <div class="neo-header-content">
              <div class="neo-status-indicator"></div>
              <span class="neo-header-title">Live Chat</span>
            </div>
            <button id="neo-close-button" class="neo-close-button" aria-label="Close chat">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M15 5L5 15M5 5L15 15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </svg>
            </button>
          </div>

          <!-- Messages Container -->
          <div id="neo-messages" class="neo-messages">
            <div class="neo-message neo-message-bot">
              <div class="neo-message-content">${config.greeting}</div>
              <div class="neo-message-time">${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
            </div>
          </div>

          <!-- Typing Indicator -->
          <div id="neo-typing-indicator" class="neo-typing-indicator" style="display: none;">
            <span></span>
            <span></span>
            <span></span>
          </div>

          <!-- Input Area -->
          <form id="neo-chat-form" class="neo-chat-form" onsubmit="return false;">
            <div class="neo-input-container">
              <input 
                type="text" 
                id="neo-message-input" 
                class="neo-message-input" 
                placeholder="Type your message..."
                autocomplete="off"
                required
              />
              <button type="button" class="neo-send-button" id="neo-send-button" aria-label="Send message">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M2 10L8 4V7.5H12C14.21 7.5 16 9.29 16 11.5V14.5L15 13.5C14.17 12.67 13.04 12.17 11.85 12.17H8V15.5L2 10Z" fill="currentColor" transform="rotate(-45 10 10)"/>
                </svg>
              </button>
            </div>
          </form>
        </div>
      </div>
    `;

    // Add widget to page
    const container = document.createElement('div');
    container.innerHTML = widgetHTML;
    document.body.appendChild(container.firstElementChild);
  }

  // Create and inject styles
  function injectStyles() {
    const styles = `
      .neo-widget-container {
        position: fixed;
        z-index: 9999;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }

      .neo-bottom-right {
        bottom: 20px;
        right: 20px;
      }

      .neo-bottom-left {
        bottom: 20px;
        left: 20px;
      }

      .neo-chat-button {
        width: 60px;
        height: 60px;
        border-radius: 50%;
        background: ${config.primaryColor};
        border: none;
        cursor: pointer;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
        display: flex;
        align-items: center;
        justify-content: center;
        position: relative;
        transition: transform 0.2s, box-shadow 0.2s;
      }

      .neo-chat-button:hover {
        transform: scale(1.05);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
      }

      .neo-unread-indicator {
        position: absolute;
        top: -5px;
        right: -5px;
        background: #ff3838;
        color: white;
        border-radius: 50%;
        width: 20px;
        height: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        font-weight: bold;
      }

      .neo-chat-window {
        position: absolute;
        bottom: 80px;
        width: 350px;
        height: 500px;
        background: white;
        border-radius: 12px;
        box-shadow: 0 4px 24px rgba(0, 0, 0, 0.15);
        display: flex;
        flex-direction: column;
        overflow: hidden;
        animation: neo-slideUp 0.3s ease;
      }

      .neo-bottom-right .neo-chat-window {
        right: 0;
      }

      .neo-bottom-left .neo-chat-window {
        left: 0;
      }

      @keyframes neo-slideUp {
        from {
          opacity: 0;
          transform: translateY(20px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      .neo-chat-header {
        background: ${config.primaryColor};
        color: white;
        padding: 16px;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .neo-header-content {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .neo-status-indicator {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #4ade80;
      }

      .neo-header-title {
        font-weight: 600;
        font-size: 16px;
      }

      .neo-close-button {
        background: none;
        border: none;
        color: white;
        cursor: pointer;
        padding: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 4px;
        transition: background 0.2s;
      }

      .neo-close-button:hover {
        background: rgba(255, 255, 255, 0.1);
      }

      .neo-messages {
        flex: 1;
        overflow-y: auto;
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .neo-message {
        max-width: 80%;
        animation: neo-fadeIn 0.3s ease;
      }

      @keyframes neo-fadeIn {
        from {
          opacity: 0;
          transform: translateY(10px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      .neo-message-user {
        align-self: flex-end;
      }

      .neo-message-bot {
        align-self: flex-start;
      }

      .neo-message-content {
        padding: 10px 14px;
        border-radius: 12px;
        word-wrap: break-word;
      }

      .neo-message-user .neo-message-content {
        background: ${config.primaryColor};
        color: white;
        border-bottom-right-radius: 4px;
      }

      .neo-message-bot .neo-message-content {
        background: #f3f4f6;
        color: #111827;
        border-bottom-left-radius: 4px;
      }

      .neo-message-time {
        font-size: 11px;
        color: #6b7280;
        margin-top: 4px;
        text-align: right;
      }

      .neo-message-bot .neo-message-time {
        text-align: left;
      }

      .neo-typing-indicator {
        padding: 16px;
        display: flex;
        gap: 4px;
      }

      .neo-typing-indicator span {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #9ca3af;
        animation: neo-bounce 1.4s infinite ease-in-out both;
      }

      .neo-typing-indicator span:nth-child(1) {
        animation-delay: -0.32s;
      }

      .neo-typing-indicator span:nth-child(2) {
        animation-delay: -0.16s;
      }

      @keyframes neo-bounce {
        0%, 80%, 100% {
          transform: scale(0);
          opacity: 0.5;
        }
        40% {
          transform: scale(1);
          opacity: 1;
        }
      }

      .neo-chat-form {
        padding: 16px;
        border-top: 1px solid #e5e7eb;
      }

      .neo-input-container {
        display: flex;
        gap: 8px;
      }

      .neo-message-input {
        flex: 1;
        padding: 10px 14px;
        border: 1px solid #e5e7eb;
        border-radius: 24px;
        outline: none;
        font-size: 14px;
        transition: border-color 0.2s;
      }

      .neo-message-input:focus {
        border-color: ${config.primaryColor};
      }

      .neo-send-button {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background: ${config.primaryColor};
        border: none;
        color: white;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: transform 0.2s, background 0.2s;
      }

      .neo-send-button:hover {
        transform: scale(1.05);
        background: ${config.primaryColor}dd;
      }

      .neo-send-button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      @media (max-width: 400px) {
        .neo-chat-window {
          width: 100vw;
          height: 100vh;
          bottom: 0;
          border-radius: 0;
        }

        .neo-widget-container {
          right: 0 !important;
          left: 0 !important;
          bottom: 0 !important;
        }

        .neo-chat-button {
          bottom: 20px;
          right: 20px;
          position: fixed;
        }
      }
    `;

    const styleSheet = document.createElement('style');
    styleSheet.textContent = styles;
    document.head.appendChild(styleSheet);
  }

  // Initialize WebSocket connection
  function connectWebSocket() {
    if (ws && ws.readyState === WebSocket.OPEN) return;

    ws = new WebSocket(config.wsUrl);

  ws.onopen = () => {
      console.log('Neo LiveChat: Connected to server');
      reconnectAttempts = 0;
      
      const visitorId = getVisitorId();
      console.log('Neo LiveChat: Using visitor ID', visitorId);
      
      // Send init message with persistent visitor ID
      ws.send(JSON.stringify({
        type: 'init',
        customerId: config.customerId,
        sessionId: visitorId
      }));
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      handleWebSocketMessage(data);
    };

    ws.onclose = () => {
      console.log('Neo LiveChat: Disconnected from server');
      // Attempt to reconnect after delay
      if (reconnectAttempts < 5) {
        setTimeout(() => {
          reconnectAttempts++;
          connectWebSocket();
        }, 1000 * Math.pow(2, reconnectAttempts));
      }
    };

    ws.onerror = (error) => {
      console.error('Neo LiveChat: WebSocket error', error);
    };
  }

  // Handle WebSocket messages
  function handleWebSocketMessage(data) {
    switch(data.type) {
      case 'initialized':
        sessionId = data.sessionId;
        console.log('Neo LiveChat: Session initialized', sessionId);
        console.log('Neo LiveChat: History received', data.history ? data.history.length + ' messages' : 'no history');
        
        // Load chat history if available
        if (data.history && data.history.length > 0) {
          // Clear default greeting if we have history
          const messagesContainer = document.getElementById('neo-messages');
          messagesContainer.innerHTML = '';
          
          // Add historical messages
          data.history.forEach(msg => {
            const sender = msg.senderType === 'visitor' ? 'user' : 'bot';
            addMessage(msg.content, sender, new Date(msg.timestamp));
          });
        }
        break;
      
      case 'message':
        addMessage(data.message, 'bot');
        if (!isOpen) {
          showUnreadIndicator();
        }
        break;

        case 'notification':
        // Handle special notifications (like human agent needed)
        addMessage(data.message, 'bot');
        if (data.needsAgent) {
          // Could add special styling or actions for agent requests
          console.log('Neo LiveChat: Human agent requested');
        }
        break;
      
      case 'typing':
        if (data.isTyping) {
          showTypingIndicator();
        } else {
          hideTypingIndicator();
        }
        break;
      
      case 'connected':
        console.log('Neo LiveChat: Session started', data.connectionId);
        break;
    }
  }

  // Add message to chat
  function addMessage(text, sender, timestamp = new Date()) {
    const messagesContainer = document.getElementById('neo-messages');
    const messageElement = document.createElement('div');
    messageElement.className = `neo-message neo-message-${sender}`;
    
    const time = timestamp instanceof Date 
      ? timestamp.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
      : new Date(timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    
    messageElement.innerHTML = `
      <div class="neo-message-content">${escapeHtml(text)}</div>
      <div class="neo-message-time">${time}</div>
    `;
    
    messagesContainer.appendChild(messageElement);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    
    messages.push({ text, sender, time });
  }

  // Send message
  function sendMessage(text) {
    if (!text.trim() || !ws || ws.readyState !== WebSocket.OPEN) return;
    
    // Add user message to UI
    addMessage(text, 'user');
    
    // Send via WebSocket
    ws.send(JSON.stringify({
      type: 'message',
      content: text,
      sessionId: sessionId
    }));
  }

  // Toggle chat window
  function toggleChat() {
    isOpen = !isOpen;
    const chatWindow = document.getElementById('neo-chat-window');
    const chatButton = document.getElementById('neo-chat-button');
    
    if (isOpen) {
      chatWindow.style.display = 'flex';
      chatButton.style.display = 'none';
      hideUnreadIndicator();
      document.getElementById('neo-message-input').focus();
      
      // Connect WebSocket if not connected
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        connectWebSocket();
      }
    } else {
      chatWindow.style.display = 'none';
      chatButton.style.display = 'flex';
    }
  }

  // Show typing indicator
  function showTypingIndicator() {
    document.getElementById('neo-typing-indicator').style.display = 'flex';
  }

  // Hide typing indicator
  function hideTypingIndicator() {
    document.getElementById('neo-typing-indicator').style.display = 'none';
  }

  // Show unread indicator
  function showUnreadIndicator() {
    const indicator = document.querySelector('.neo-unread-indicator');
    if (indicator) {
      indicator.style.display = 'flex';
      const count = parseInt(indicator.textContent) || 0;
      indicator.textContent = count + 1;
    }
  }

  // Hide unread indicator
  function hideUnreadIndicator() {
    const indicator = document.querySelector('.neo-unread-indicator');
    if (indicator) {
      indicator.style.display = 'none';
      indicator.textContent = '0';
    }
  }

  // Escape HTML to prevent XSS
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

// Generate or retrieve visitor ID
  function getVisitorId() {
    // Try to get existing visitor ID from localStorage (persists across refreshes)
    let visitorId = localStorage.getItem('neo-livechat-visitor-id');
    
    if (!visitorId) {
      // Generate new visitor ID
      visitorId = 'visitor_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
      localStorage.setItem('neo-livechat-visitor-id', visitorId);
    }
    
    return visitorId;
  }

  // Initialize widget
  function init() {
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
      return;
    }

    // Inject styles and create widget
    injectStyles();
    createWidgetHTML();

    // Add event listeners
    document.getElementById('neo-chat-button').addEventListener('click', toggleChat);
    document.getElementById('neo-close-button').addEventListener('click', toggleChat);
    
    // Handle send button click
    document.getElementById('neo-send-button').addEventListener('click', (e) => {
      e.preventDefault();
      const input = document.getElementById('neo-message-input');
      const message = input.value.trim();
      
      if (message) {
        sendMessage(message);
        input.value = '';
      }
    });

    // Handle enter key - simplified
    document.getElementById('neo-message-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        
        const input = e.target;
        const message = input.value.trim();
        
        if (message) {
          sendMessage(message);
          input.value = '';
        }
      }
    });

    console.log('Neo LiveChat: Widget initialized');
  }

  // Start initialization
  init();
})();