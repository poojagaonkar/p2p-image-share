class P2PImageShare {
    constructor() {
        this.peer = null;
        this.connections = new Map();
        this.roomId = null;
        this.isHost = false;
        
        this.initializeElements();
        this.setupEventListeners();
    }

    initializeElements() {
        this.statusElement = document.getElementById('status');
        this.roomIdInput = document.getElementById('roomId');
        this.createRoomBtn = document.getElementById('createRoom');
        this.joinRoomBtn = document.getElementById('joinRoom');
        this.fileInput = document.getElementById('fileInput');
        this.dropZone = document.getElementById('dropZone');
        this.imageGallery = document.getElementById('imageGallery');
    }

    setupEventListeners() {
        this.createRoomBtn.addEventListener('click', () => this.createRoom());
        this.joinRoomBtn.addEventListener('click', () => this.joinRoom());
        this.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
        
        // Drag and drop handlers
        this.dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.dropZone.style.borderColor = 'var(--primary-color)';
        });

        this.dropZone.addEventListener('dragleave', () => {
            this.dropZone.style.borderColor = '#ddd';
        });

        this.dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            this.dropZone.style.borderColor = '#ddd';
            const files = e.dataTransfer.files;
            this.handleFiles(files);
        });
    }

    async createRoom() {
        try {
            this.peer = new Peer({
                secure: true,
                host: '0.peerjs.com',
                port: 443
            });
            this.peer.on('open', (id) => {
                this.roomId = id;
                this.isHost = true;
                this.updateStatus('Room created. Share this ID: ' + id);
                this.roomIdInput.value = id;
            });

            this.peer.on('connection', (conn) => {
                this.handleNewConnection(conn);
            });
        } catch (error) {
            console.error('Error creating room:', error);
            this.updateStatus('Error creating room');
        }
    }

    async joinRoom() {
        const roomId = this.roomIdInput.value.trim();
        if (!roomId) {
            this.updateStatus('Please enter a room ID');
            return;
        }

        try {
            this.peer = new Peer({
                secure: true,
                host: '0.peerjs.com',
                port: 443
            });
            this.peer.on('open', () => {
                const conn = this.peer.connect(roomId);
                this.handleNewConnection(conn);
                this.roomId = roomId;
                this.isHost = false;
                this.updateStatus('Connected to room: ' + roomId);
            });
        } catch (error) {
            console.error('Error joining room:', error);
            this.updateStatus('Error joining room');
        }
    }

    handleNewConnection(conn) {
        conn.on('open', () => {
            this.connections.set(conn.peer, conn);
            this.updateStatus('Connected to peer: ' + conn.peer);
        });

        conn.on('data', (data) => {
            if (data.type === 'image') {
                this.displayImage(data.imageData);
            }
        });

        conn.on('close', () => {
            this.connections.delete(conn.peer);
            this.updateStatus('Peer disconnected');
        });
    }

    handleFileSelect(event) {
        const files = event.target.files;
        this.handleFiles(files);
    }

    async handleFiles(files) {
        for (const file of files) {
            if (file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const imageData = e.target.result;
                    this.displayImage(imageData);
                    this.shareImage(imageData);
                };
                reader.readAsDataURL(file);
            }
        }
    }

    displayImage(imageData) {
        const img = document.createElement('img');
        img.src = imageData;
        img.alt = 'Shared image';
        this.imageGallery.appendChild(img);
    }

    shareImage(imageData) {
        const message = {
            type: 'image',
            imageData: imageData
        };

        this.connections.forEach(conn => {
            if (conn.open) {
                conn.send(message);
            }
        });
    }

    updateStatus(message) {
        this.statusElement.textContent = message;
    }
}

// Initialize the app when the page loads
window.addEventListener('load', () => {
    new P2PImageShare();
}); 