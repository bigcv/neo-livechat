// Basic AI Service for Neo LiveChat
// Provides intelligent responses without external AI APIs

class AIService {
  constructor() {
    // Intent patterns
    this.intents = {
      greeting: {
        patterns: [
          /^(hi|hello|hey|howdy|greetings|good morning|good afternoon|good evening)/i,
          /^(what'?s up|sup|yo)/i,
          /^(how are you|how do you do)/i
        ],
        responses: [
          "Hello! How can I help you today?",
          "Hi there! What can I assist you with?",
          "Welcome! How may I help you?",
          "Hello! I'm here to help. What do you need assistance with?"
        ]
      },
      
      goodbye: {
        patterns: [
          /^(bye|goodbye|see you|farewell|take care|ciao|later)/i,
          /^(thanks? bye|thank you,? bye)/i,
          /^(have a good|have a nice)/i
        ],
        responses: [
          "Goodbye! Have a great day!",
          "Thank you for chatting with us. Take care!",
          "See you later! Feel free to return if you need more help.",
          "Bye! Don't hesitate to reach out if you need anything else."
        ]
      },
      
      thanks: {
        patterns: [
          /^(thanks?|thank you|thx|ty)/i,
          /^(appreciate|grateful)/i,
          /^(you'?re? (the )?best|you rock|awesome)/i
        ],
        responses: [
          "You're welcome! Happy to help!",
          "My pleasure! Is there anything else I can help with?",
          "Glad I could assist! Let me know if you need anything else.",
          "You're very welcome! 😊"
        ]
      },
      
      help: {
        patterns: [
          /^(help|need help|can you help|help me)/i,
          /^(what can you do|how can you help)/i,
          /^(support|assistance|i need)/i
        ],
        responses: [
          "I'm here to help! I can answer questions about our products, services, pricing, or help with technical issues. What would you like to know?",
          "I'd be happy to help! You can ask me about:\n• Product information\n• Pricing and plans\n• Technical support\n• Account questions\n\nWhat do you need help with?",
          "Sure, I can help! What specific information are you looking for?"
        ]
      },
      
      pricing: {
        patterns: [
          /(price|pricing|cost|how much|plans?|subscription)/i,
          /(free trial|trial|demo)/i,
          /(payment|billing|invoice)/i
        ],
        responses: [
          "We offer several pricing plans:\n\n• **Free Plan**: Perfect for small teams (up to 100 chats/month)\n• **Pro Plan**: $29/month for unlimited chats\n• **Business Plan**: $99/month with advanced features\n• **Enterprise**: Custom pricing\n\nAll paid plans include a 14-day free trial. Would you like more details about any specific plan?"
        ]
      },
      
      features: {
        patterns: [
          /(features?|functionality|what.*(do|offer)|capabilities)/i,
          /(integration|api|customize|customization)/i,
          /(analytics|reports?|dashboard)/i
        ],
        responses: [
          "Our chat platform includes:\n\n✨ **Core Features**:\n• Real-time messaging\n• AI-powered responses\n• Conversation history\n• File sharing\n• Mobile responsive\n\n📊 **Analytics**:\n• Chat metrics\n• Response times\n• Customer satisfaction\n\n🔧 **Integrations**:\n• REST API\n• Webhooks\n• Slack/Teams\n• CRM systems\n\nWhat feature interests you most?"
        ]
      },
      
      technical: {
        patterns: [
          /(not working|broken|error|bug|issue|problem)/i,
          /(can'?t|cannot|unable to|won'?t)/i,
          /(install|setup|configure|integration)/i
        ],
        responses: [
          "I'm sorry you're experiencing issues. Let me help you troubleshoot:\n\n1. What specific problem are you encountering?\n2. When did this start happening?\n3. Have you tried refreshing the page?\n\nYou can also email our technical team at support@neochat.com for immediate assistance."
        ]
      },
      
      contact: {
        patterns: [
          /(contact|email|phone|call|reach|get in touch)/i,
          /(human|agent|representative|person|support team)/i,
          /(sales|demo|meeting|schedule)/i
        ],
        responses: [
          "Here's how to reach our team:\n\n📧 **Email**: support@neochat.com\n📞 **Phone**: 1-800-NEO-CHAT\n💬 **Live Support**: Available Mon-Fri, 9AM-6PM EST\n\nFor sales inquiries: sales@neochat.com\n\nWould you like me to connect you with a human agent now?"
        ]
      },
      
      business_hours: {
        patterns: [
          /(hours|open|closed|available|business hours)/i,
          /(when.*available|support hours)/i,
          /(weekend|after hours|24.7)/i
        ],
        responses: [
          "Our support hours are:\n\n🕐 **Monday-Friday**: 9:00 AM - 6:00 PM EST\n🕐 **Saturday**: 10:00 AM - 4:00 PM EST\n🕐 **Sunday**: Closed\n\nOur AI assistant (that's me!) is available 24/7 to help with common questions. For urgent issues outside business hours, please email urgent@neochat.com"
        ]
      }
    };
    
    // FAQ database
    this.faqs = [
      {
        keywords: ['reset', 'password', 'forgot', 'login'],
        answer: "To reset your password:\n1. Go to the login page\n2. Click 'Forgot Password'\n3. Enter your email\n4. Check your email for reset instructions\n\nIf you don't receive the email within 5 minutes, check your spam folder."
      },
      {
        keywords: ['widget', 'install', 'embed', 'website', 'add'],
        answer: "To install the chat widget on your website:\n\n```html\n<script src=\"https://neochat.com/widget.js\" \n  data-customer-id=\"YOUR_ID\"\n  async>\n</script>\n```\n\nJust add this code before the closing </body> tag. Need help with a specific platform?"
      },
      {
        keywords: ['data', 'privacy', 'gdpr', 'security', 'encryption'],
        answer: "We take data security seriously:\n\n🔒 **Encryption**: All data is encrypted in transit and at rest\n🛡️ **Compliance**: GDPR, CCPA, and SOC 2 compliant\n🔐 **Security**: Regular security audits and penetration testing\n📊 **Your Data**: You own your data and can export/delete it anytime\n\nRead our full privacy policy at neochat.com/privacy"
      },
      {
        keywords: ['cancel', 'refund', 'subscription', 'unsubscribe'],
        answer: "You can cancel your subscription anytime:\n\n1. Log into your dashboard\n2. Go to Settings → Billing\n3. Click 'Cancel Subscription'\n\nWe offer a 30-day money-back guarantee. If you cancel within 30 days, you'll receive a full refund. No questions asked!"
      },
      {
        keywords: ['api', 'developers', 'documentation', 'integrate'],
        answer: "For developers, we offer:\n\n📚 **API Documentation**: api.neochat.com/docs\n🔧 **SDKs**: JavaScript, Python, Ruby, PHP\n🎯 **Webhooks**: Real-time event notifications\n💻 **GraphQL API**: For advanced queries\n\nNeed help with integration? Check our developer guide or email developers@neochat.com"
      }
    ];
    
    // Small talk responses
    this.smallTalk = {
      patterns: [
        { pattern: /how are you/i, responses: ["I'm doing great, thanks for asking! How can I help you today?", "I'm here and ready to help! What can I do for you?"] },
        { pattern: /what'?s your name/i, responses: ["I'm Neo, your AI assistant! How can I help you today?", "You can call me Neo! I'm here to assist with any questions you have."] },
        { pattern: /are you (a )?robot/i, responses: ["I'm an AI assistant designed to help answer your questions! While I am automated, I'm here to provide real help. What can I assist you with?"] },
        { pattern: /weather/i, responses: ["I'm focused on helping with our chat platform, but for weather updates, I'd recommend checking weather.com! Is there anything about our service I can help with?"] },
        { pattern: /joke/i, responses: ["Why don't programmers like nature? It has too many bugs! 😄 Now, what can I help you with today?"] },
        { pattern: /(who made|who created|who built)/i, responses: ["I was created by the Neo LiveChat team to help answer your questions! Speaking of which, what would you like to know?"] }
      ]
    };
    
    // Context memory for follow-up questions
    this.conversationContext = new Map();
  }
  
  // Main method to generate response
  async generateResponse(message, sessionId, conversationHistory = []) {
    const lowerMessage = message.toLowerCase().trim();
    
    // Update context
    this.updateContext(sessionId, message, conversationHistory);
    
    // 1. Check for exact intent match
    const intentResponse = this.checkIntents(message);
    if (intentResponse) {
      return {
        response: intentResponse,
        intent: 'matched',
        confidence: 0.9
      };
    }
    
    // 2. Check FAQs
    const faqResponse = this.checkFAQs(lowerMessage);
    if (faqResponse) {
      return {
        response: faqResponse,
        intent: 'faq',
        confidence: 0.85
      };
    }
    
    // 3. Check small talk
    const smallTalkResponse = this.checkSmallTalk(message);
    if (smallTalkResponse) {
      return {
        response: smallTalkResponse,
        intent: 'small_talk',
        confidence: 0.7
      };
    }
    
    // 4. Context-aware responses
    const contextResponse = this.getContextualResponse(sessionId, message);
    if (contextResponse) {
      return {
        response: contextResponse,
        intent: 'contextual',
        confidence: 0.75
      };
    }
    
    // 5. Business hours check
    if (this.isAfterHours() && lowerMessage.includes('now')) {
      return {
        response: "I'm here to help! While our human support team is currently offline (business hours: Mon-Fri 9AM-6PM EST), I can assist with most questions. What do you need help with?",
        intent: 'after_hours',
        confidence: 0.6
      };
    }
    
    // 6. Fallback response
    return {
      response: this.getFallbackResponse(message),
      intent: 'fallback',
      confidence: 0.3
    };
  }
  
  // Check for intent matches
  checkIntents(message) {
    for (const [intentName, intent] of Object.entries(this.intents)) {
      for (const pattern of intent.patterns) {
        if (pattern.test(message)) {
          return this.randomChoice(intent.responses);
        }
      }
    }
    return null;
  }
  
  // Check FAQ database
  checkFAQs(message) {
    for (const faq of this.faqs) {
      const matchCount = faq.keywords.filter(keyword => 
        message.includes(keyword.toLowerCase())
      ).length;
      
      if (matchCount >= 2 || (matchCount === 1 && message.split(' ').length <= 5)) {
        return faq.answer;
      }
    }
    return null;
  }
  
  // Check small talk patterns
  checkSmallTalk(message) {
    for (const talk of this.smallTalk.patterns) {
      if (talk.pattern.test(message)) {
        return this.randomChoice(talk.responses);
      }
    }
    return null;
  }
  
  // Get contextual response based on conversation history
  getContextualResponse(sessionId, message) {
    const context = this.conversationContext.get(sessionId);
    if (!context) return null;
    
    // Handle follow-up questions
    if (message.toLowerCase().includes('more') || message.toLowerCase().includes('else')) {
      if (context.lastTopic === 'pricing') {
        return "Here are more details about our pricing:\n\n• **Free Plan**: 100 chats/month, 1 agent, basic features\n• **Pro Plan**: Unlimited chats, 5 agents, API access, priority support\n• **Business Plan**: Everything in Pro + custom branding, advanced analytics, SLA\n\nWould you like to start a free trial?";
      }
      if (context.lastTopic === 'features') {
        return "Additional features include:\n\n• **Automation**: Set up auto-responses and chat flows\n• **Team Collaboration**: Internal notes and agent handoff\n• **Custom Fields**: Collect specific customer information\n• **Export Options**: Download chat transcripts and analytics\n• **White Label**: Remove our branding on Business plan\n\nAnything specific you'd like to explore?";
      }
    }
    
    return null;
  }
  
  // Update conversation context
  updateContext(sessionId, message, history) {
    const context = this.conversationContext.get(sessionId) || { topics: [], lastTopic: null };
    
    // Detect topic from message
    if (message.match(/pric|cost|plan|subscription/i)) {
      context.lastTopic = 'pricing';
      context.topics.push('pricing');
    } else if (message.match(/feature|function|capabilit/i)) {
      context.lastTopic = 'features';
      context.topics.push('features');
    }
    
    this.conversationContext.set(sessionId, context);
  }
  
  // Get fallback response
  getFallbackResponse(message) {
    const fallbacks = [
      "I'm not quite sure about that. Could you rephrase your question? Or would you like to speak with a human agent?",
      "I don't have a specific answer for that, but I'd be happy to connect you with our support team who can help!",
      "That's a great question! For the most accurate answer, let me connect you with our support team. Would you like me to do that?",
      "I want to make sure you get the right information. You can either rephrase your question, or I can connect you with a specialist. What would you prefer?"
    ];
    
    // If message is very short, ask for more info
    if (message.split(' ').length <= 2) {
      return "Could you tell me a bit more about what you need help with? I'm here to assist with questions about our chat platform, pricing, features, or technical support.";
    }
    
    return this.randomChoice(fallbacks);
  }
  
  // Check if current time is after business hours
  isAfterHours() {
    const now = new Date();
    const hours = now.getHours();
    const day = now.getDay();
    
    // Weekend
    if (day === 0 || day === 6) return true;
    
    // Weekday before 9 AM or after 6 PM (assuming EST)
    if (hours < 9 || hours >= 18) return true;
    
    return false;
  }
  
  // Utility: Random choice from array
  randomChoice(array) {
    return array[Math.floor(Math.random() * array.length)];
  }
  
  // Analyze sentiment (basic)
  analyzeSentiment(message) {
    const positive = /😊|😄|🙂|😃|great|excellent|good|thanks|love|awesome|perfect/i;
    const negative = /😞|😠|😡|😤|bad|terrible|awful|hate|worst|horrible|sucks/i;
    const urgent = /urgent|emergency|asap|immediately|now|help!/i;
    
    if (urgent.test(message)) return 'urgent';
    if (negative.test(message)) return 'negative';
    if (positive.test(message)) return 'positive';
    return 'neutral';
  }
  
  // Check if message needs human intervention
  needsHumanAgent(message, sentiment) {
    // Keywords that indicate human agent needed
    const humanKeywords = /human|agent|representative|person|real person|speak to|talk to someone/i;
    const complexIssues = /refund|legal|lawsuit|injured|emergency|urgent.*help/i;
    
    return humanKeywords.test(message) || 
           complexIssues.test(message) || 
           sentiment === 'urgent' ||
           (sentiment === 'negative' && message.length > 100);
  }
}

module.exports = new AIService();