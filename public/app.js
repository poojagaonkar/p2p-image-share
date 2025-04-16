class P2PImageShare {
    constructor() {
        this.peer = null;
        this.connections = new Map();
        this.roomId = null;
        this.isHost = false;
        
        // Version management
        this.version = '1.0.0';
        this.versionElement = document.getElementById('version');
        this.versionElement.textContent = this.version;
        
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
        this.peerCountElement = document.getElementById('peerCount');
        this.copyButton = document.getElementById('copyRoomId');
    }

    setupEventListeners() {
        this.createRoomBtn.addEventListener('click', () => this.createRoom());
        this.joinRoomBtn.addEventListener('click', () => this.joinRoom());
        this.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
        this.copyButton.addEventListener('click', () => this.copyRoomId());
        
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
                this.updateStatus(`Room created. Share this ID: ${id}`);
                this.roomIdInput.value = id;
                this.updatePeerCount();
            });

            this.peer.on('connection', (conn) => {
                this.handleNewConnection(conn);
            });

            this.peer.on('error', (err) => {
                console.error('Peer error:', err);
                this.updateStatus('Connection error: ' + err.type);
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
                port: 443,
                debug: 3  // Enable debug logging
            });

            this.peer.on('open', () => {
                console.log('Attempting to connect to peer:', roomId);
                const conn = this.peer.connect(roomId);
                
                // Add connection timeout
                const timeout = setTimeout(() => {
                    if (!conn.open) {
                        this.updateStatus('Connection timeout - peer not responding');
                        console.error('Connection timeout to peer:', roomId);
                    }
                }, 10000);  // 10 second timeout

                conn.on('open', () => {
                    clearTimeout(timeout);
                    this.handleNewConnection(conn);
                    this.roomId = roomId;
                    this.isHost = false;
                    this.updateStatus(`Connected to room: ${roomId}`);
                    this.updatePeerCount();
                });

                conn.on('error', (err) => {
                    clearTimeout(timeout);
                    console.error('Connection error:', err);
                    this.updateStatus(`Connection error: ${err.type} - ${err.message}`);
                });
            });

            this.peer.on('error', (err) => {
                console.error('Peer error:', err);
                this.updateStatus(`Connection error: ${err.type} - ${err.message}`);
            });
        } catch (error) {
            console.error('Error joining room:', error);
            this.updateStatus(`Error joining room: ${error.message}`);
        }
    }

    handleNewConnection(conn) {
        conn.on('open', () => {
            this.connections.set(conn.peer, conn);
            this.updateStatus(`Connected to peer: ${conn.peer}`);
            this.updatePeerCount();
            
            // Share version information with new peer
            conn.send({
                type: 'version',
                version: this.version
            });
        });

        conn.on('data', (data) => {
            if (data.type === 'image') {
                this.displayImage(data.imageData);
            } else if (data.type === 'version') {
                console.log(`Peer version: ${data.version}`);
                // You could add logic here to handle version compatibility
            }
        });

        conn.on('close', () => {
            this.connections.delete(conn.peer);
            this.updateStatus('Peer disconnected');
            this.updatePeerCount();
        });

        conn.on('error', (err) => {
            console.error('Connection error:', err);
            this.updateStatus('Connection error with peer');
        });
    }

    handleFileSelect(event) {
        const files = event.target.files;
        this.handleFiles(files);
    }

    async handleFiles(files) {
        for (const file of files) {
            if (file.type.startsWith('image/')) {
                try {
                    const imageData = await this.readFileAsDataURL(file);
                    this.displayImage(imageData);
                    this.shareImage(imageData);
                } catch (error) {
                    console.error('Error handling file:', error);
                    this.updateStatus('Error processing image');
                }
            }
        }
    }

    readFileAsDataURL(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(e);
            reader.readAsDataURL(file);
        });
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
                try {
                    conn.send(message);
                } catch (error) {
                    console.error('Error sending image:', error);
                    this.updateStatus('Error sending image to peer');
                }
            }
        });
    }

    updatePeerCount() {
        const count = this.connections.size;
        this.peerCountElement.textContent = count;
        
        if (this.isHost) {
            this.updateStatus(`Room: ${this.roomId} - ${count} peer${count !== 1 ? 's' : ''} connected`);
        } else {
            this.updateStatus(`Connected to room: ${this.roomId} - ${count} peer${count !== 1 ? 's' : ''} connected`);
        }
    }

    updateStatus(message) {
        this.statusElement.textContent = message;
    }

    incrementVersion(type = 'patch') {
        const [major, minor, patch] = this.version.split('.').map(Number);
        
        switch(type) {
            case 'major':
                this.version = `${major + 1}.0.0`;
                break;
            case 'minor':
                this.version = `${major}.${minor + 1}.0`;
                break;
            case 'patch':
            default:
                this.version = `${major}.${minor}.${patch + 1}`;
                break;
        }
        
        this.versionElement.textContent = this.version;
        console.log(`Version updated to ${this.version}`);
    }

    async copyRoomId() {
        const roomId = this.roomIdInput.value.trim();
        if (!roomId) {
            this.updateStatus('No room ID to copy');
            return;
        }

        try {
            await navigator.clipboard.writeText(roomId);
            this.copyButton.classList.add('copied');
            this.updateStatus('Room ID copied to clipboard');
            
            // Remove the copied class after 2 seconds
            setTimeout(() => {
                this.copyButton.classList.remove('copied');
            }, 2000);
        } catch (err) {
            console.error('Failed to copy room ID:', err);
            this.updateStatus('Failed to copy room ID');
        }
    }
}

// Initialize the app when the page loads
window.addEventListener('load', () => {
    new P2PImageShare();
}); 