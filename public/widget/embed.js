// Neo LiveChat Embed Script
// This is what customers add to their websites
(function() {
  // Get configuration from script tag
  const script = document.currentScript || document.querySelector('script[data-customer-id]');
  const customerId = script.getAttribute('data-customer-id') || 'demo';
  const apiUrl = script.getAttribute('data-api-url') || 'http://localhost:3000';
  
  // Set global config
  window.NeoLiveChatConfig = {
    customerId: customerId,
    apiUrl: apiUrl,
    wsUrl: apiUrl.replace('http', 'ws') + '/ws',
    position: script.getAttribute('data-position') || 'bottom-right',
    primaryColor: script.getAttribute('data-primary-color') || '#0066cc'
  };

  // Load the main widget script
  const widgetScript = document.createElement('script');
  widgetScript.src = apiUrl + '/widget/widget.js';
  widgetScript.async = true;
  
  // Load widget after getting configuration
  fetch(`${apiUrl}/api/widget/config?customerId=${customerId}`)
    .then(response => response.json())
    .then(config => {
      // Merge remote config with local config
      window.NeoLiveChatConfig = {
        ...window.NeoLiveChatConfig,
        ...config.theme,
        greeting: config.theme?.greeting || window.NeoLiveChatConfig.greeting
      };
      
      // Load widget
      document.head.appendChild(widgetScript);
    })
    .catch(error => {
      console.error('Neo LiveChat: Failed to load configuration', error);
      // Load widget with default config anyway
      document.head.appendChild(widgetScript);
    });
})();