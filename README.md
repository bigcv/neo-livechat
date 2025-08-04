# NEO Live Chat

An enterprise-ready, AI-powered live chat platform that businesses can integrate into their websites for intelligent customer support.

## 🚀 Features

- **AI-Powered Responses**: Intelligent chat responses using our AI trained with your custom Messages
- **Real-time Communication**: WebSocket-based live chat
- **Easy Integration**: Simple JavaScript widget for any website
- **Multi-tenant Architecture**: Secure isolation between customers
- **Analytics Dashboard**: Track conversations, response times, and satisfaction
- **Customizable**: Fully customizable chat widget appearance
- **Scalable**: Docker-based deployment ready for production

## 📋 Prerequisites

- Ubuntu 20.04+ (or similar Linux distribution)
- Node.js 20+
- Docker and Docker Compose
- Git
- PostgreSQL 15+ (via Docker)
- Redis 7+ (via Docker)

## 🛠️ Tech Stack

- **Backend**: Node.js, Express, WebSocket
- **Database**: PostgreSQL
- **Cache**: Redis
- **AI**: OpenAI API / Claude API
- **Containerization**: Docker & Docker Compose
- **Authentication**: JWT
- **Security**: Helmet, CORS, Rate Limiting

## 🏃‍♂️ Quick Start

### 1. Clone the repository
```bash
git clone git@github.com:yourusername/neo-livechat.git
cd ai-chat-platform
```

### 2. Set up environment variables
```bash
cp .env.example .env
# Edit .env with your actual values (especially OPENAI_API_KEY)
```

### 3. Install dependencies
```bash
npm install
```

### 4. Start with Docker
```bash
# Start all services
docker compose up

# Or run in background
docker compose up -d

# View logs
docker compose logs -f
```

### 5. Verify installation
```bash
# Check API health
curl http://localhost:3000/health

# Check WebSocket
wscat -c ws://localhost:3000/ws
```

## 📁 Project Structure

```
neo-livechat/
├── src/
│   ├── api/
│   │   ├── index.js          # Main API server
│   │   ├── routes/           # API routes
│   │   ├── services/         # Business logic
│   │   ├── models/           # Database models
│   │   ├── middleware/       # Express middleware
│   │   └── utils/            # Helper functions
│   ├── client/
│   │   ├── widget/           # Embeddable chat widget
│   │   └── dashboard/        # Admin dashboard
│   └── shared/               # Shared utilities
├── config/                   # Configuration files
├── scripts/                  # Database migrations, etc.
├── docs/                     # Documentation
├── docker-compose.yml        # Docker composition
├── Dockerfile               # Container definition
├── package.json             # Dependencies
└── README.md               # This file
```

## 🔧 Development

### Run locally without Docker
```bash
# Start PostgreSQL and Redis manually, then:
npm run dev
```

### Run tests
```bash
npm test
```

### Database migrations
```bash
npm run db:migrate
```

### Linting
```bash
npm run lint
```

## 🚀 Deployment

### Production build
```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

### Environment variables for production
- Set strong passwords for all services
- Use proper JWT secret
- Configure SSL/TLS
- Set up proper CORS origins
- Enable rate limiting

## 📦 Widget Integration

Customers can add the chat widget to their website:

```html
<!-- Add before closing </body> tag -->
<script>
  (function() {
    var script = document.createElement('script');
    script.src = 'https://your-domain.com/widget.js';
    script.async = true;
    script.setAttribute('data-customer-id', 'YOUR_CUSTOMER_ID');
    document.body.appendChild(script);
  })();
</script>
```

## 🔐 Security

- All data encrypted in transit (TLS)
- JWT-based authentication
- Rate limiting on all endpoints
- Input validation and sanitization
- SQL injection protection
- XSS protection
- CORS properly configured

## 📊 Monitoring

- Health check: `/health`
- Metrics endpoint: `/metrics` (coming soon)
- Logs: Check Docker logs or `/logs` directory

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the ISC License.

## 🆘 Support

- Documentation: `/docs`
- Issues: GitHub Issues
- Email: support@your-domain.com

## 🗺️ Roadmap

- [ ] Multi-language support
- [ ] Voice chat capabilities
- [ ] Mobile SDKs (iOS/Android)
- [ ] Advanced analytics
- [ ] Slack/Teams integration
- [ ] Automated chat workflows
- [ ] Sentiment analysis
- [ ] File sharing
- [ ] Video chat support

---

Built with ❤️ for better customer support