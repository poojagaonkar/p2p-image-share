class P2PImageShare {
    constructor() {
        this.peer = null;
        this.connections = new Map();
        this.roomId = null;
        this.isHost = false;
        
        // Version management
        this.version = '1.1.0';
        this.minCompatibleVersion = '1.0.0';
        this.versionElement = document.getElementById('version');
        this.versionStatusElement = document.getElementById('versionStatus');
        this.versionElement.textContent = this.version;
        
        // Connection monitoring
        this.connectionCheckInterval = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 3;
        
        // Debug info
        this.debugInfo = {
            lastReceivedImage: null,
            lastSentImage: null,
            connectionStatus: 'disconnected',
            peerId: null,
            connectedPeers: []
        };
        
        this.initializeElements();
        this.setupEventListeners();
        this.createDebugPanel();
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
        this.versionStatusElement = document.getElementById('versionStatus');
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

    createDebugPanel() {
        // Create debug panel
        const debugPanel = document.createElement('div');
        debugPanel.className = 'debug-panel';
        debugPanel.innerHTML = `
            <div class="debug-header">
                <h3>Debug Info</h3>
                <button id="toggleDebug">Show/Hide</button>
            </div>
            <div class="debug-content">
                <div class="debug-item">
                    <span class="debug-label">Connection Status:</span>
                    <span id="debugConnectionStatus">disconnected</span>
                </div>
                <div class="debug-item">
                    <span class="debug-label">Your Peer ID:</span>
                    <span id="debugPeerId">-</span>
                </div>
                <div class="debug-item">
                    <span class="debug-label">Connected Peers:</span>
                    <span id="debugConnectedPeers">0</span>
                </div>
                <div class="debug-item">
                    <span class="debug-label">Last Image Received:</span>
                    <span id="debugLastReceived">None</span>
                </div>
                <div class="debug-item">
                    <span class="debug-label">Last Image Sent:</span>
                    <span id="debugLastSent">None</span>
                </div>
                <div class="debug-item">
                    <span class="debug-label">Device Type:</span>
                    <span id="debugDeviceType">${this.getDeviceType()}</span>
                </div>
                <div class="debug-item">
                    <button id="debugTestConnection">Test Connection</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(debugPanel);
        
        // Add event listeners
        document.getElementById('toggleDebug').addEventListener('click', () => {
            debugPanel.classList.toggle('expanded');
        });
        
        document.getElementById('debugTestConnection').addEventListener('click', () => {
            this.testConnection();
        });
    }
    
    getDeviceType() {
        const ua = navigator.userAgent;
        if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
            return 'tablet';
        }
        if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(ua)) {
            return 'mobile';
        }
        return 'desktop';
    }
    
    updateDebugInfo() {
        if (document.getElementById('debugConnectionStatus')) {
            document.getElementById('debugConnectionStatus').textContent = this.debugInfo.connectionStatus;
        }
        if (document.getElementById('debugPeerId')) {
            document.getElementById('debugPeerId').textContent = this.debugInfo.peerId || '-';
        }
        if (document.getElementById('debugConnectedPeers')) {
            document.getElementById('debugConnectedPeers').textContent = this.debugInfo.connectedPeers.length;
        }
        if (document.getElementById('debugLastReceived')) {
            document.getElementById('debugLastReceived').textContent = this.debugInfo.lastReceivedImage ? 'Yes' : 'None';
        }
        if (document.getElementById('debugLastSent')) {
            document.getElementById('debugLastSent').textContent = this.debugInfo.lastSentImage ? 'Yes' : 'None';
        }
    }
    
    testConnection() {
        if (this.connections.size === 0) {
            this.updateStatus('No peers connected to test with');
            return;
        }
        
        this.updateStatus('Testing connection with peers...');
        
        // Send a test message to all peers
        this.connections.forEach((conn, peerId) => {
            if (conn.open) {
                try {
                    conn.send({
                        type: 'test',
                        message: 'Connection test',
                        timestamp: Date.now()
                    });
                    console.log(`Test message sent to peer: ${peerId}`);
                } catch (error) {
                    console.error(`Error sending test to peer ${peerId}:`, error);
                }
            }
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
                this.startConnectionMonitoring();
                
                // Update debug info
                this.debugInfo.peerId = id;
                this.debugInfo.connectionStatus = 'connected';
                this.updateDebugInfo();
            });

            this.peer.on('connection', (conn) => {
                this.handleNewConnection(conn);
            });

            this.peer.on('error', (err) => {
                console.error('Peer error:', err);
                this.updateStatus('Connection error: ' + err.type);
                
                // Update debug info
                this.debugInfo.connectionStatus = `error: ${err.type}`;
                this.updateDebugInfo();
            });
            
            this.peer.on('disconnected', () => {
                console.log('Peer disconnected, attempting to reconnect...');
                this.updateStatus('Connection lost, reconnecting...');
                this.peer.reconnect();
                
                // Update debug info
                this.debugInfo.connectionStatus = 'disconnected';
                this.updateDebugInfo();
            });
            
            this.peer.on('close', () => {
                console.log('Peer connection closed');
                this.updateStatus('Connection closed');
                this.stopConnectionMonitoring();
                
                // Update debug info
                this.debugInfo.connectionStatus = 'closed';
                this.updateDebugInfo();
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
                
                // Update debug info
                this.debugInfo.peerId = this.peer.id;
                this.debugInfo.connectionStatus = 'connecting';
                this.updateDebugInfo();
                
                // Add connection timeout
                const timeout = setTimeout(() => {
                    if (!conn.open) {
                        this.updateStatus('Connection timeout - peer not responding');
                        console.error('Connection timeout to peer:', roomId);
                        
                        // Update debug info
                        this.debugInfo.connectionStatus = 'timeout';
                        this.updateDebugInfo();
                    }
                }, 10000);  // 10 second timeout

                conn.on('open', () => {
                    clearTimeout(timeout);
                    this.handleNewConnection(conn);
                    this.roomId = roomId;
                    this.isHost = false;
                    this.updateStatus(`Connected to room: ${roomId}`);
                    this.updatePeerCount();
                    this.startConnectionMonitoring();
                    
                    // Update debug info
                    this.debugInfo.connectionStatus = 'connected';
                    this.updateDebugInfo();
                });

                conn.on('error', (err) => {
                    clearTimeout(timeout);
                    console.error('Connection error:', err);
                    this.updateStatus(`Connection error: ${err.type} - ${err.message}`);
                    
                    // Update debug info
                    this.debugInfo.connectionStatus = `error: ${err.type}`;
                    this.updateDebugInfo();
                });
            });

            this.peer.on('error', (err) => {
                console.error('Peer error:', err);
                this.updateStatus(`Connection error: ${err.type} - ${err.message}`);
                
                // Update debug info
                this.debugInfo.connectionStatus = `error: ${err.type}`;
                this.updateDebugInfo();
            });
            
            this.peer.on('disconnected', () => {
                console.log('Peer disconnected, attempting to reconnect...');
                this.updateStatus('Connection lost, reconnecting...');
                this.peer.reconnect();
                
                // Update debug info
                this.debugInfo.connectionStatus = 'disconnected';
                this.updateDebugInfo();
            });
            
            this.peer.on('close', () => {
                console.log('Peer connection closed');
                this.updateStatus('Connection closed');
                this.stopConnectionMonitoring();
                
                // Update debug info
                this.debugInfo.connectionStatus = 'closed';
                this.updateDebugInfo();
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
                version: this.version,
                minCompatibleVersion: this.minCompatibleVersion
            });
            
            console.log(`New connection established with peer: ${conn.peer}`);
            
            // Update debug info
            this.debugInfo.connectedPeers.push(conn.peer);
            this.updateDebugInfo();
        });

        conn.on('data', (data) => {
            console.log(`Received data from peer ${conn.peer}:`, data.type);
            
            if (data.type === 'image') {
                console.log(`Received image data, length: ${data.imageData ? data.imageData.length : 'undefined'} characters`);
                this.displayImage(data.imageData);
                
                // Update debug info
                this.debugInfo.lastReceivedImage = Date.now();
                this.updateDebugInfo();
            } else if (data.type === 'version') {
                console.log(`Peer version: ${data.version}, min compatible: ${data.minCompatibleVersion}`);
                this.checkVersionCompatibility(data.version, data.minCompatibleVersion, conn);
            } else if (data.type === 'test') {
                console.log(`Received test message from peer ${conn.peer}:`, data.message);
                this.updateStatus(`Connection test successful with peer ${conn.peer}`);
                
                // Send acknowledgment
                conn.send({
                    type: 'test_ack',
                    message: 'Test received',
                    timestamp: Date.now()
                });
            } else if (data.type === 'test_ack') {
                console.log(`Received test acknowledgment from peer ${conn.peer}:`, data.message);
                this.updateStatus(`Connection test successful with peer ${conn.peer}`);
            }
        });

        conn.on('close', () => {
            this.connections.delete(conn.peer);
            this.updateStatus('Peer disconnected');
            this.updatePeerCount();
            console.log(`Peer disconnected: ${conn.peer}`);
            
            // Update debug info
            this.debugInfo.connectedPeers = this.debugInfo.connectedPeers.filter(id => id !== conn.peer);
            this.updateDebugInfo();
        });

        conn.on('error', (err) => {
            console.error('Connection error:', err);
            this.updateStatus('Connection error with peer');
            
            // Update debug info
            this.debugInfo.connectionStatus = `error: ${err.type}`;
            this.updateDebugInfo();
        });
    }

    checkVersionCompatibility(peerVersion, peerMinVersion, conn) {
        // Parse versions
        const [major, minor, patch] = this.version.split('.').map(Number);
        const [peerMajor, peerMinor, peerPatch] = peerVersion.split('.').map(Number);
        const [minMajor, minMinor, minPatch] = this.minCompatibleVersion.split('.').map(Number);
        const [peerMinMajor, peerMinMinor, peerMinPatch] = peerMinVersion.split('.').map(Number);
        
        // Check if our version is compatible with peer's minimum
        const isCompatibleWithPeer = 
            major > peerMinMajor || 
            (major === peerMinMajor && minor > peerMinMinor) || 
            (major === peerMinMajor && minor === peerMinMinor && patch >= peerMinPatch);
        
        // Check if peer's version is compatible with our minimum
        const isPeerCompatibleWithUs = 
            peerMajor > minMajor || 
            (peerMajor === minMajor && peerMinor > minMinor) || 
            (peerMajor === minMajor && peerMinor === minMinor && peerPatch >= minPatch);
        
        // Update version status indicator
        if (isCompatibleWithPeer && isPeerCompatibleWithUs) {
            this.updateVersionStatus('compatible');
        } else if (!isCompatibleWithPeer && !isPeerCompatibleWithUs) {
            this.updateVersionStatus('incompatible');
        } else {
            this.updateVersionStatus('warning');
        }
        
        if (!isCompatibleWithPeer) {
            console.warn(`Our version ${this.version} is not compatible with peer's minimum version ${peerMinVersion}`);
            this.updateStatus(`Warning: Your version may not be compatible with the peer`);
        }
        
        if (!isPeerCompatibleWithUs) {
            console.warn(`Peer's version ${peerVersion} is not compatible with our minimum version ${this.minCompatibleVersion}`);
            this.updateStatus(`Warning: Peer's version may not be compatible with yours`);
        }
        
        // Send acknowledgment
        conn.send({
            type: 'version_ack',
            compatible: isCompatibleWithPeer && isPeerCompatibleWithUs
        });
    }

    updateVersionStatus(status) {
        // Remove all status classes
        this.versionStatusElement.classList.remove('compatible', 'incompatible', 'warning');
        
        // Add the new status class
        if (status) {
            this.versionStatusElement.classList.add(status);
        }
    }

    handleFileSelect(event) {
        const files = event.target.files;
        this.handleFiles(files);
    }

    async handleFiles(files) {
        for (const file of files) {
            if (file.type.startsWith('image/')) {
                try {
                    console.log(`Processing image file: ${file.name}, size: ${file.size} bytes`);
                    
                    // Compress image if it's too large
                    let imageData;
                    if (file.size > 500000) { // If larger than ~500KB
                        console.log('Image is large, compressing before sending...');
                        imageData = await this.compressImage(file);
                    } else {
                        imageData = await this.readFileAsDataURL(file);
                    }
                    
                    console.log(`Image data length: ${imageData.length} characters`);
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

    async compressImage(file) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                
                // Calculate new dimensions while maintaining aspect ratio
                const maxDimension = 1200; // Max width or height
                if (width > height && width > maxDimension) {
                    height = Math.round((height * maxDimension) / width);
                    width = maxDimension;
                } else if (height > maxDimension) {
                    width = Math.round((width * maxDimension) / height);
                    height = maxDimension;
                }
                
                canvas.width = width;
                canvas.height = height;
                
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                
                // Compress as JPEG with 0.7 quality
                const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.7);
                console.log(`Compressed image from ${file.size} bytes to ${compressedDataUrl.length} characters`);
                resolve(compressedDataUrl);
            };
            
            img.onerror = () => {
                reject(new Error('Failed to load image for compression'));
            };
            
            // Load the image from the file
            const reader = new FileReader();
            reader.onload = (e) => {
                img.src = e.target.result;
            };
            reader.onerror = () => {
                reject(new Error('Failed to read file'));
            };
            reader.readAsDataURL(file);
        });
    }

    displayImage(imageData) {
        const img = document.createElement('img');
        img.src = imageData;
        img.alt = 'Shared image';
        
        // Add loading state
        img.style.opacity = '0';
        
        // Create a container for the image with loading indicator
        const container = document.createElement('div');
        container.className = 'image-container';
        
        // Add loading indicator
        const loadingIndicator = document.createElement('div');
        loadingIndicator.className = 'loading-indicator';
        loadingIndicator.innerHTML = '<div class="spinner"></div>';
        container.appendChild(loadingIndicator);
        
        // Add image to container
        container.appendChild(img);
        
        // Add to gallery
        this.imageGallery.appendChild(container);
        
        // Handle image load
        img.onload = () => {
            // Fade in the image
            img.style.transition = 'opacity 0.3s ease-in-out';
            img.style.opacity = '1';
            
            // Remove loading indicator
            loadingIndicator.remove();
            
            // Scroll to the new image
            container.scrollIntoView({ behavior: 'smooth', block: 'end' });
        };
        
        // Handle image error
        img.onerror = () => {
            container.innerHTML = '<div class="error-message">Failed to load image</div>';
        };
    }

    shareImage(imageData) {
        const message = {
            type: 'image',
            imageData: imageData
        };

        console.log(`Sharing image with ${this.connections.size} peers`);
        
        // Update debug info
        this.debugInfo.lastSentImage = Date.now();
        this.updateDebugInfo();
        
        this.connections.forEach(conn => {
            if (conn.open) {
                try {
                    console.log(`Sending image to peer: ${conn.peer}`);
                    conn.send(message);
                    console.log(`Image sent successfully to peer: ${conn.peer}`);
                } catch (error) {
                    console.error('Error sending image:', error);
                    this.updateStatus('Error sending image to peer');
                }
            } else {
                console.warn(`Connection to peer ${conn.peer} is not open`);
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
        
        // Update minCompatibleVersion if needed
        if (type === 'major') {
            this.minCompatibleVersion = this.version;
        }
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

    startConnectionMonitoring() {
        // Check connection status every 10 seconds
        this.connectionCheckInterval = setInterval(() => {
            this.checkConnections();
        }, 10000);
    }
    
    stopConnectionMonitoring() {
        if (this.connectionCheckInterval) {
            clearInterval(this.connectionCheckInterval);
            this.connectionCheckInterval = null;
        }
    }
    
    checkConnections() {
        if (!this.peer || this.peer.disconnected) {
            console.log('Peer is disconnected, attempting to reconnect...');
            this.updateStatus('Connection lost, reconnecting...');
            this.peer.reconnect();
            return;
        }
        
        // Check if we have any open connections
        let hasOpenConnections = false;
        this.connections.forEach((conn, peerId) => {
            if (conn.open) {
                hasOpenConnections = true;
            } else {
                console.warn(`Connection to peer ${peerId} is not open`);
                this.connections.delete(peerId);
            }
        });
        
        // If we're not the host and have no open connections, try to reconnect
        if (!this.isHost && !hasOpenConnections && this.roomId) {
            console.log('No open connections, attempting to reconnect...');
            this.updateStatus('Connection lost, attempting to reconnect...');
            
            if (this.reconnectAttempts < this.maxReconnectAttempts) {
                this.reconnectAttempts++;
                this.joinRoom();
            } else {
                this.updateStatus('Failed to reconnect after multiple attempts');
                this.stopConnectionMonitoring();
            }
        }
    }
}

// Initialize the app when the page loads
window.addEventListener('load', () => {
    new P2PImageShare();
}); 