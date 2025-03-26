"use strict";

window.currentGame = null;

class ChessGame {
    constructor(isSinglePlayer, render = true) {
        this.isSinglePlayer = isSinglePlayer;
        this.board = this.initializeBoard();
        this.currentPlayer = 'white';
        this.selectedPiece = null;
        this.gameOver = false;
        this.moveHistory = [];
        this.moveNotation = [];
        this.hasMoved = { whiteKing: false, blackKing: false, whiteRooks: [false, false], blackRooks: [false, false] };
        this.enPassantTarget = null;
        this.aiMoveTimeout = null;
        this.promotionContainer = null;
        this.possibleMoves = [];
        this.isPromoting = false;
        this.isRestarting = false;
        this.isRendering = false;
        this.lastMove = null; // Track last move for highlighting
        this.moveCount = 0; // Track move number
        this.setupEventListeners();
        if (render) {
            this.renderBoard();
        }
        console.log('Game initialized');
    }

    initializeBoard() {
        const board = Array(8).fill().map(() => Array(8).fill(null));
        for (let i = 0; i < 8; i++) {
            board[1][i] = { type: 'pawn', color: 'black' };
            board[6][i] = { type: 'pawn', color: 'white' };
        }
        const backRow = ['rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook'];
        for (let i = 0; i < 8; i++) {
            board[0][i] = { type: backRow[i], color: 'black' };
            board[7][i] = { type: backRow[i], color: 'white' };
        }
        return board;
    }

    getPieceSymbol(piece) {
        const symbols = {
            'pawn': { white: '♙', black: '♟' },
            'rook': { white: '♖', black: '♜' },
            'knight': { white: '♘', black: '♞' },
            'bishop': { white: '♗', black: '♝' },
            'queen': { white: '♕', black: '♛' },
            'king': { white: '♔', black: '♚' }
        };
        return symbols[piece.type][piece.color];
    }

    renderBoard() {
        if (this.isRestarting) {
            console.log('Skipping renderBoard during restart');
            return;
        }
        if (this.isRendering) {
            console.log('Render recursion prevented');
            return;
        }
        this.isRendering = true;
        console.log('Rendering board - triggered by:', new Error().stack.split('\n')[1]);
        const boardElement = document.getElementById('board');
        if (!boardElement) {
            console.error('Board element not found in DOM');
            this.isRendering = false;
            return;
        }
        boardElement.innerHTML = '';
    
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const square = document.createElement('div');
                square.className = `square ${(row + col) % 2 === 0 ? 'light' : 'dark'}`;
                square.dataset.row = row;
                square.dataset.col = col;
    
                const piece = this.board[row][col];
                if (piece) {
                    const pieceSpan = document.createElement('span'); // Wrap piece in a span
                    pieceSpan.className = 'piece';
                    pieceSpan.textContent = this.getPieceSymbol(piece);
                    square.appendChild(pieceSpan);
                }
    
                if (this.selectedPiece && this.selectedPiece.row === row && this.selectedPiece.col === col) {
                    square.classList.add('selected');
                }
                if (this.possibleMoves.some(move => move.row === row && move.col === col)) {
                    square.classList.add('possible-move');
                }
                if (this.lastMove && 
                    ((this.lastMove.fromRow === row && this.lastMove.fromCol === col) || 
                     (this.lastMove.toRow === row && this.lastMove.toCol === col))) {
                    square.classList.add('last-move');
                }
    
                square.removeEventListener('click', this.handleSquareClick);
                square.addEventListener('click', () => this.handleSquareClick(row, col));
                boardElement.appendChild(square);
            }
        }
    
        const status = document.getElementById('status');
        if (this.gameOver) {
            status.classList.add('game-over');
            if (this.isCheckmate()) {
                status.textContent = `Checkmate! ${this.currentPlayer === 'white' ? 'Black' : 'White'} wins!`;
            } else if (this.isStalemate()) {
                status.textContent = 'Stalemate! Game is a draw.';
            }
            this.showGameOverOverlay();
        } else {
            status.classList.remove('game-over');
            status.textContent = `${this.currentPlayer}'s turn` + 
                (this.isInCheck(this.currentPlayer) ? ' - In Check!' : '') +
                (this.isPromoting ? ' - Select Promotion' : '');
            this.hideGameOverOverlay();
        }
    
        const moveHistoryElement = document.getElementById('move-history');
        moveHistoryElement.innerHTML = `<div>Move: ${this.moveCount}</div>` + 
            this.moveNotation.map((move, i) => 
                `<div>${Math.floor(i / 2) + 1}. ${i % 2 === 0 ? move : move}</div>`).join('');
    
        const undoButton = document.getElementById('undo');
        undoButton.disabled = this.moveHistory.length === 0 || this.gameOver;
    
        if (this.promotionContainer && !this.isPromoting && (!this.selectedPiece || 
            !(this.board[this.selectedPiece.row][this.selectedPiece.col]?.type === 'pawn' && 
              (this.selectedPiece.row === 0 || this.selectedPiece.row === 7)))) {
            this.promotionContainer.remove();
            this.promotionContainer = null;
        }
        this.isRendering = false;
    }

    handleSquareClick(row, col) {
        console.log(`Square clicked: ${row},${col}, gameOver: ${this.gameOver}, isRestarting: ${this.isRestarting}`);
        if (this.gameOver) {
            console.log('Game over - click ignored');
            return;
        }
    
        // Ignore clicks if it's Black's turn in single-player mode
        if (this.isSinglePlayer && this.currentPlayer === 'black') {
            console.log('Ignoring click during AI turn');
            return;
        }
    
        const piece = this.board[row][col];
        if (this.selectedPiece) {
            const fromRow = this.selectedPiece.row;
            const fromCol = this.selectedPiece.col;
            console.log(`Trying to move from ${fromRow},${fromCol} to ${row},${col}`);
    
            if (this.isValidMove(fromRow, fromCol, row, col)) {
                console.log('Move is valid');
                const tempBoard = JSON.parse(JSON.stringify(this.board));
                const capturedPiece = this.board[row][col];
                const isCastling = this.board[fromRow][fromCol]?.type === 'king' && Math.abs(fromCol - col) === 2;
                const isEnPassant = this.board[fromRow][fromCol]?.type === 'pawn' && col !== fromCol && !capturedPiece;
    
                if (this.board[fromRow][fromCol]?.type === 'pawn' && (row === 0 || row === 7)) {
                    this.showPromotionOptions(row, col, fromRow, fromCol, tempBoard, capturedPiece);
                } else {
                    this.animateMove(fromRow, fromCol, row, col, capturedPiece ? 'capture' : 'move', () => {
                        this.makeMove(fromRow, fromCol, row, col, 'queen');
                        if (this.isInCheck(this.currentPlayer)) {
                            console.log('Move puts king in check, reverting');
                            this.board = tempBoard;
                            this.clearHighlights();
                            this.selectedPiece = null;
                            this.renderBoard();
                        } else {
                            this.commitMove(fromRow, fromCol, row, col, tempBoard, capturedPiece, isCastling, isEnPassant);
                        }
                    });
                }
            } else {
                console.log('Invalid move');
                this.clearHighlights();
                this.selectedPiece = null;
                this.renderBoard();
            }
        } else if (piece && piece.color === this.currentPlayer) {
            console.log(`Selected piece: ${piece.type} at ${row},${col}`);
            this.selectedPiece = { row, col };
            this.highlightPossibleMoves(row, col);
            this.renderBoard();
        }
    }

    // Evaluation function: scores the board from Black's perspective
    evaluateBoard() {
        const pieceValues = {
            pawn: 100,
            knight: 320,
            bishop: 330,
            rook: 500,
            queen: 900,
            king: 20000
        };
        let score = 0;

        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const piece = this.board[row][col];
                if (piece) {
                    const value = pieceValues[piece.type];
                    score += (piece.color === 'black' ? value : -value);
                }
            }
        }

        // Basic positional bonus: encourage pawns to advance
        for (let col = 0; col < 8; col++) {
            const blackPawn = this.board[1][col];
            const whitePawn = this.board[6][col];
            if (blackPawn && blackPawn.type === 'pawn') score += (6 - 1) * 10; // Black pawns forward
            if (whitePawn && whitePawn.type === 'pawn') score -= (6 - 6) * 10; // White pawns back
        }

        return score;
    }

    // New: Generate all possible moves for a piece (before validation)
    getPossibleMoves(row, col) {
        const piece = this.board[row][col];
        if (!piece) return [];
        const moves = [];
        const direction = piece.color === 'white' ? -1 : 1;
        const startRow = piece.color === 'white' ? 6 : 1;

        switch (piece.type) {
            case 'pawn':
                if (this.isInBounds(row + direction, col) && !this.board[row + direction][col]) {
                    moves.push({ row: row + direction, col });
                    if (row === startRow && !this.board[row + 2 * direction][col]) {
                        moves.push({ row: row + 2 * direction, col });
                    }
                }
                [-1, 1].forEach(dc => {
                    if (this.isInBounds(row + direction, col + dc)) {
                        moves.push({ row: row + direction, col: col + dc });
                    }
                });
                break;
            case 'knight':
                const knightMoves = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
                knightMoves.forEach(([dr, dc]) => {
                    if (this.isInBounds(row + dr, col + dc)) moves.push({ row: row + dr, col: col + dc });
                });
                break;
            case 'bishop':
                this.addSlidingMoves(row, col, [[-1, -1], [-1, 1], [1, -1], [1, 1]], moves);
                break;
            case 'rook':
                this.addSlidingMoves(row, col, [[-1, 0], [1, 0], [0, -1], [0, 1]], moves);
                break;
            case 'queen':
                this.addSlidingMoves(row, col, [[-1, -1], [-1, 1], [1, -1], [1, 1], [-1, 0], [1, 0], [0, -1], [0, 1]], moves);
                break;
            case 'king':
                const kingMoves = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
                kingMoves.forEach(([dr, dc]) => {
                    if (this.isInBounds(row + dr, col + dc)) moves.push({ row: row + dr, col: col + dc });
                });
                if (!this.hasMoved[piece.color + 'King']) {
                    if (!this.hasMoved[piece.color + 'Rooks'][0] && !this.board[row][1] && !this.board[row][2] && !this.board[row][3]) {
                        moves.push({ row, col: col - 2 });
                    }
                    if (!this.hasMoved[piece.color + 'Rooks'][1] && !this.board[row][5] && !this.board[row][6]) {
                        moves.push({ row, col: col + 2 });
                    }
                }
                break;
        }
        return moves;
    }

    // Helper for sliding pieces (bishop, rook, queen)
    addSlidingMoves(row, col, directions, moves) {
        directions.forEach(([dr, dc]) => {
            let r = row + dr, c = col + dc;
            while (this.isInBounds(r, c)) {
                moves.push({ row: r, col: c });
                if (this.board[r][c]) break;
                r += dr;
                c += dc;
            }
        });
    }

    isInBounds(row, col) {
        return row >= 0 && row < 8 && col >= 0 && col < 8;
    }

    // Get all legal moves for a player
    getAllMoves(color) {
        const moves = [];
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const piece = this.board[row][col];
                if (piece && piece.color === color) {
                    const possibleMoves = this.getPossibleMoves(row, col);
                    for (const { row: toRow, col: toCol } of possibleMoves) {
                        if (this.isValidMove(row, col, toRow, toCol)) {
                            moves.push({ fromRow: row, fromCol: col, toRow, toCol });
                        }
                    }
                }
            }
        }
        return moves;
    }

    animateMove(fromRow, fromCol, toRow, toCol, soundType, callback) {
        const fromSquare = document.querySelector(`.square[data-row="${fromRow}"][data-col="${fromCol}"]`);
        const toSquare = document.querySelector(`.square[data-row="${toRow}"][data-col="${toCol}"]`);
        if (!fromSquare || !toSquare) {
            console.log(`Squares not found: fromSquare=${!!fromSquare}, toSquare=${!!toSquare}`);
            callback();
            return;
        }
    
        const pieceElement = fromSquare.querySelector('.piece'); // Target the span
        if (!pieceElement) {
            console.log(`No piece element at ${fromRow},${fromCol} in DOM`);
            console.log(`fromSquare content: ${fromSquare.innerHTML}`);
            callback();
            return;
        }
    
        console.log(`Animating piece from ${fromRow},${fromCol} to ${toRow},${toCol}`);
    
        const fromRect = fromSquare.getBoundingClientRect();
        const toRect = toSquare.getBoundingClientRect();
        const dx = toRect.left - fromRect.left;
        const dy = toRect.top - fromRect.top;
    
        pieceElement.style.transition = 'transform 0.3s ease';
        pieceElement.style.transform = `translate(${dx}px, ${dy}px)`;
    
        setTimeout(() => {
            pieceElement.style.transition = '';
            pieceElement.style.transform = '';
            toSquare.innerHTML = ''; // Clear target square
            toSquare.appendChild(pieceElement);
            this.playSound(soundType);
            callback();
        }, 300);
    }

    playSound(type) {
        const sounds = {
            move: new Audio('https://www.soundjay.com/buttons/beep-01a.mp3'),
            capture: new Audio('https://www.soundjay.com/buttons/beep-02.mp3'),
            gameEnd: new Audio('https://www.soundjay.com/buttons/beep-03.mp3')
        };
        if (sounds[type]) sounds[type].play().catch(e => console.log('Sound error:', e));
    }

    showGameOverOverlay() {
        let overlay = document.getElementById('game-over-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'game-over-overlay';
            overlay.innerHTML = `
                <div class="overlay-content">
                    <h2>Game Over</h2>
                    <p id="game-over-message"></p>
                    <button id="restart-from-overlay">Restart</button>
                    <button id="undo-from-overlay" ${this.moveHistory.length === 0 ? 'disabled' : ''}>Undo</button>
                </div>
            `;
            document.getElementById('game-container').appendChild(overlay);
            document.getElementById('restart-from-overlay').addEventListener('click', () => this.restartHandler());
            document.getElementById('undo-from-overlay').addEventListener('click', () => this.undoMove());
        }
        const message = this.isCheckmate() 
            ? `Checkmate! ${this.currentPlayer === 'white' ? 'Black' : 'White'} wins!`
            : 'Stalemate! Game is a draw.';
        document.getElementById('game-over-message').textContent = message;
        overlay.style.display = 'flex';
        this.playSound('gameEnd');
    }

    hideGameOverOverlay() {
        const overlay = document.getElementById('game-over-overlay');
        if (overlay) overlay.style.display = 'none';
    }

    showPromotionOptions(row, col, fromRow, fromCol, tempBoard, capturedPiece) {
        if (this.promotionContainer) {
            this.promotionContainer.remove();
        }
    
        this.isPromoting = true;
        this.promotionContainer = document.createElement('div');
        this.promotionContainer.className = 'promotion-options';
        this.promotionContainer.innerHTML = `
            <h3>Promote Pawn</h3>
            <button id="promote-queen">Queen</button>
            <button id="promote-rook">Rook</button>
            <button id="promote-bishop">Bishop</button>
            <button id="promote-knight">Knight</button>
        `;
    
        const sidebar = document.getElementById('sidebar');
        sidebar.insertBefore(this.promotionContainer, document.getElementById('controls'));
    
        const options = ['queen', 'rook', 'bishop', 'knight'];
        options.forEach(type => {
            const button = document.getElementById(`promote-${type}`);
            button.onclick = () => {
                const isCastling = this.board[fromRow][fromCol].type === 'king' && Math.abs(fromCol - col) === 2;
                const isEnPassant = this.board[fromRow][fromCol].type === 'pawn' && col !== fromCol && !capturedPiece;
                this.animateMove(fromRow, fromCol, row, col, capturedPiece ? 'capture' : 'move', () => {
                    this.makeMove(fromRow, fromCol, row, col, type);
                    console.log('After makeMove, board:', JSON.stringify(this.board));
                    if (this.isInCheck(this.currentPlayer)) {
                        console.log('Move puts king in check, reverting');
                        this.board = tempBoard;
                        this.clearHighlights();
                        this.selectedPiece = null;
                    } else {
                        this.commitMove(fromRow, fromCol, row, col, tempBoard, capturedPiece, isCastling, isEnPassant);
                    }
                    this.promotionContainer.remove();
                    this.promotionContainer = null;
                    this.isPromoting = false;
                    this.renderBoard();
                });
            };
        });
        this.renderBoard();
    }


    commitMove(fromRow, fromCol, toRow, toCol, tempBoard, capturedPiece, isCastling = false, isEnPassant = false) {
        this.moveHistory.push({
            fromRow, fromCol, toRow, toCol,
            board: tempBoard,
            capturedPiece,
            currentPlayer: this.currentPlayer,
            enPassantTarget: this.enPassantTarget
        });
        this.addMoveNotation(fromRow, fromCol, toRow, toCol, capturedPiece, isCastling, isEnPassant);
        this.updateCastlingFlags(fromRow, fromCol, toRow, toCol);
        this.currentPlayer = this.currentPlayer === 'white' ? 'black' : 'white';
        this.moveCount = Math.floor(this.moveHistory.length / 2) + 1;
        this.lastMove = { fromRow, fromCol, toRow, toCol };
        this.clearHighlights();
        this.selectedPiece = null;
    
        if (this.isCheckmate()) {
            console.log('Checkmate detected');
            this.gameOver = true;
        } else if (this.isStalemate()) {
            console.log('Stalemate detected');
            this.gameOver = true;
        }
    
        this.renderBoard(); // Render immediately after move
    
        if (this.isSinglePlayer && this.currentPlayer === 'black' && !this.gameOver && !this.isRestarting) {
            if (this.aiMoveTimeout) {
                clearTimeout(this.aiMoveTimeout);
                console.log('Cleared existing AI timeout');
            }
            console.log('Scheduling AI move');
            this.aiMoveTimeout = setTimeout(() => {
                console.log('AI move timeout triggered');
                this.makeAIMove();
            }, 500);
        }
    }

    addMoveNotation(fromRow, fromCol, toRow, toCol, capturedPiece, isCastling, isEnPassant) {
        const piece = this.board[toRow][toCol];
        const fromFile = String.fromCharCode(97 + fromCol);
        const fromRank = 8 - fromRow;
        const toFile = String.fromCharCode(97 + toCol);
        const toRank = 8 - toRow;
        let notation = '';

        if (isCastling) {
            notation = toCol > fromCol ? 'O-O' : 'O-O-O';
        } else if (isEnPassant) {
            notation = `${fromFile}x${toFile}${toRank} e.p.`;
        } else if (piece.type === 'pawn') {
            notation = capturedPiece ? `${fromFile}x${toFile}${toRank}` : `${toFile}${toRank}`;
        } else {
            const pieceSymbol = piece.type.charAt(0).toUpperCase();
            notation = capturedPiece ? `${pieceSymbol}x${toFile}${toRank}` : `${pieceSymbol}${toFile}${toRank}`;
        }

        this.moveNotation.push(notation);
    }

    updateCastlingFlags(fromRow, fromCol, toRow, toCol) {
        const piece = this.board[toRow][toCol];
        if (!piece) return;

        if (piece.type === 'king') {
            if (piece.color === 'white') this.hasMoved.whiteKing = true;
            else this.hasMoved.blackKing = true;
        } else if (piece.type === 'rook') {
            if (piece.color === 'white') {
                if (fromCol === 0) this.hasMoved.whiteRooks[0] = true;
                else if (fromCol === 7) this.hasMoved.whiteRooks[1] = true;
            } else {
                if (fromCol === 0) this.hasMoved.blackRooks[0] = true;
                else if (fromCol === 7) this.hasMoved.blackRooks[1] = true;
            }
        }
    }

    undoMove() {
        if (this.moveHistory.length === 0 || this.gameOver) return;

        const lastMove = this.moveHistory.pop();
        this.board = lastMove.board;
        this.currentPlayer = lastMove.currentPlayer;
        this.enPassantTarget = lastMove.enPassantTarget;
        this.moveNotation.pop();
        this.selectedPiece = null;
        this.clearHighlights();
        this.renderBoard();
        console.log('Move undone');
    }

    isValidMove(fromRow, fromCol, toRow, toCol, skipCastling = false) {
        const piece = this.board[fromRow][fromCol];
        if (!piece || (this.board[toRow][toCol] && this.board[toRow][toCol].color === piece.color)) {
            return false;
        }

        const rowDiff = toRow - fromRow;
        const colDiff = toCol - fromCol;
        const direction = piece.color === 'white' ? -1 : 1;

        switch (piece.type) {
            case 'pawn':
                if (colDiff === 0 && !this.board[toRow][toCol]) {
                    if (rowDiff === direction) return true;
                    if (rowDiff === 2 * direction && 
                        !this.board[fromRow + direction][fromCol] && 
                        ((piece.color === 'white' && fromRow === 6) || 
                         (piece.color === 'black' && fromRow === 1))) {
                        this.enPassantTarget = { row: fromRow + direction, col: fromCol };
                        return true;
                    }
                }
                if (Math.abs(colDiff) === 1 && rowDiff === direction) {
                    if (this.board[toRow][toCol] || 
                        (this.enPassantTarget && toRow === this.enPassantTarget.row && toCol === this.enPassantTarget.col)) {
                        return true;
                    }
                }
                return false;

            case 'rook':
                return (rowDiff === 0 || colDiff === 0) && this.isPathClear(fromRow, fromCol, toRow, toCol);

            case 'knight':
                return (Math.abs(rowDiff) === 2 && Math.abs(colDiff) === 1) || 
                       (Math.abs(rowDiff) === 1 && Math.abs(colDiff) === 2);

            case 'bishop':
                return Math.abs(rowDiff) === Math.abs(colDiff) && this.isPathClear(fromRow, fromCol, toRow, toCol);

            case 'queen':
                return ((rowDiff === 0 || colDiff === 0) || Math.abs(rowDiff) === Math.abs(colDiff)) && 
                    this.isPathClear(fromRow, fromCol, toRow, toCol);

            case 'king':
                if (Math.abs(rowDiff) <= 1 && Math.abs(colDiff) <= 1) return true;
                if (!skipCastling && rowDiff === 0 && Math.abs(colDiff) === 2) {
                    return this.isValidCastling(fromRow, fromCol, toRow, toCol);
                }
                return false;
        }
        return false;
    }

    isValidCastling(fromRow, fromCol, toRow, toCol) {
        const color = this.board[fromRow][fromCol].color;
        const kingMoved = color === 'white' ? this.hasMoved.whiteKing : this.hasMoved.blackKing;
        const rookIndex = toCol > fromCol ? 1 : 0;
        const rookMoved = color === 'white' ? this.hasMoved.whiteRooks[rookIndex] : this.hasMoved.blackRooks[rookIndex];
        const rookCol = toCol > fromCol ? 7 : 0;

        if (kingMoved || rookMoved || this.isInCheck(color)) return false;
        if (!this.isPathClear(fromRow, fromCol, fromRow, rookCol)) return false;

        const step = toCol > fromCol ? 1 : -1;
        for (let col = fromCol + step; col !== toCol + step; col += step) {
            const tempBoard = JSON.parse(JSON.stringify(this.board));
            tempBoard[fromRow][col] = tempBoard[fromRow][fromCol];
            tempBoard[fromRow][fromCol] = null;

            // Directly check if opponent can attack this square, avoid full ChessGame instance
            const opponentColor = color === 'white' ? 'black' : 'white';
            for (let i = 0; i < 8; i++) {
                for (let j = 0; j < 8; j++) {
                    if (tempBoard[i][j]?.color === opponentColor) {
                        if (this.isValidMove(i, j, fromRow, col, true)) { // Skip castling in this check
                            return false;
                        }
                    }
                }
            }
        }
        return true;
    }

    isPathClear(fromRow, fromCol, toRow, toCol) {
        const rowStep = Math.sign(toRow - fromRow);
        const colStep = Math.sign(toCol - fromCol);
        let row = fromRow + rowStep;
        let col = fromCol + colStep;

        while (row !== toRow || col !== toCol) {
            if (this.board[row][col]) return false;
            row += rowStep;
            col += colStep;
        }
        return true;
    }

    highlightPossibleMoves(row, col) {
        this.clearHighlights();
        this.possibleMoves = [];

        for (let i = 0; i < 8; i++) {
            for (let j = 0; j < 8; j++) {
                if (this.isValidMove(row, col, i, j)) { // Default skipCastling = false
                    const tempBoard = JSON.parse(JSON.stringify(this.board));
                    const piece = tempBoard[row][col];
                    tempBoard[i][j] = piece;
                    tempBoard[row][col] = null;

                    if (piece.type === 'king' && Math.abs(j - col) === 2) {
                        const rookCol = j > col ? 7 : 0;
                        const rookToCol = j > col ? col + 1 : col - 1;
                        tempBoard[row][rookToCol] = tempBoard[row][rookCol];
                        tempBoard[row][rookCol] = null;
                    } else if (piece.type === 'pawn' && (i === 0 || i === 7)) {
                        tempBoard[i][j] = { type: 'queen', color: piece.color };
                    }

                    const tempGame = new ChessGame(this.isSinglePlayer, false);
                    tempGame.board = tempBoard;
                    tempGame.currentPlayer = this.currentPlayer;
                    if (!tempGame.isInCheck(this.currentPlayer)) {
                        this.possibleMoves.push({ row: i, col: j });
                        console.log(`Possible move: ${i},${j}`);
                    }
                }
            }
        }
    }

    clearHighlights() {
        this.possibleMoves = [];
    }

    makeMove(fromRow, fromCol, toRow, toCol, promotionType = 'queen') {
        console.log(`Making move from ${fromRow},${fromCol} to ${toRow},${toCol}`);
        const piece = this.board[fromRow][fromCol];
        const isCastling = piece.type === 'king' && Math.abs(fromCol - toCol) === 2;
        const isEnPassant = piece.type === 'pawn' && toCol !== fromCol && !this.board[toRow][toCol] && 
                            this.enPassantTarget && toRow === this.enPassantTarget.row && toCol === this.enPassantTarget.col;

        if (isCastling) {
            const rookFromCol = toCol > fromCol ? 7 : 0;
            const rookToCol = toCol > fromCol ? fromCol + 1 : fromCol - 1;
            this.board[fromRow][toCol] = this.board[fromRow][fromCol];
            this.board[fromRow][fromCol] = null;
            this.board[fromRow][rookToCol] = this.board[fromRow][rookFromCol];
            this.board[fromRow][rookFromCol] = null;
        } else if (isEnPassant) {
            this.board[toRow][toCol] = this.board[fromRow][fromCol];
            this.board[fromRow][fromCol] = null;
            this.board[this.enPassantTarget.row][this.enPassantTarget.col] = null;
        } else {
            this.board[toRow][toCol] = this.board[fromRow][fromCol];
            this.board[fromRow][fromCol] = null;
        }

        if (piece.type === 'pawn' && (toRow === 0 || toRow === 7)) {
            this.board[toRow][toCol].type = promotionType;
        }

        this.enPassantTarget = null;
        if (piece.type === 'pawn' && Math.abs(fromRow - toRow) === 2) {
            this.enPassantTarget = { row: (fromRow + toRow) / 2, col: fromCol };
        }
    }

    isInCheck(color) {
        let kingRow, kingCol;
        for (let i = 0; i < 8; i++) {
            for (let j = 0; j < 8; j++) {
                if (this.board[i][j]?.type === 'king' && this.board[i][j]?.color === color) {
                    kingRow = i;
                    kingCol = j;
                    break;
                }
            }
        }

        if (kingRow === undefined || kingCol === undefined) {
            console.log(`No king found for ${color}, assuming captured`);
            this.gameOver = true;
            return false;
        }

        const opponentColor = color === 'white' ? 'black' : 'white';
        for (let i = 0; i < 8; i++) {
            for (let j = 0; j < 8; j++) {
                if (this.board[i][j]?.color === opponentColor) {
                    if (this.isValidMove(i, j, kingRow, kingCol, true)) { // Skip castling
                        console.log(`${color} king in check from ${i},${j}`);
                        return true;
                    }
                }
            }
        }
        return false;
    }

    isCheckmate() {
        if (!this.isInCheck(this.currentPlayer)) return false;

        for (let fromRow = 0; fromRow < 8; fromRow++) {
            for (let fromCol = 0; fromCol < 8; fromCol++) {
                if (this.board[fromRow][fromCol]?.color === this.currentPlayer) {
                    for (let toRow = 0; toRow < 8; toRow++) {
                        for (let toCol = 0; toCol < 8; toCol++) {
                            if (this.isValidMove(fromRow, fromCol, toRow, toCol)) {
                                const tempBoard = JSON.parse(JSON.stringify(this.board));
                                const piece = tempBoard[fromRow][fromCol];
                                tempBoard[toRow][toCol] = piece;
                                tempBoard[fromRow][fromCol] = null;
                                if (piece.type === 'king' && Math.abs(toCol - fromCol) === 2) {
                                    const rookCol = toCol > fromCol ? 7 : 0;
                                    const rookToCol = toCol > fromCol ? fromCol + 1 : fromCol - 1;
                                    tempBoard[fromRow][rookToCol] = tempBoard[fromRow][rookCol];
                                    tempBoard[fromRow][rookCol] = null;
                                } else if (piece.type === 'pawn' && (toRow === 0 || toRow === 7)) {
                                    tempBoard[toRow][toCol] = { type: 'queen', color: piece.color };
                                }

                                const tempGame = new ChessGame(this.isSinglePlayer, false);
                                tempGame.board = tempBoard;
                                tempGame.currentPlayer = this.currentPlayer;
                                if (!tempGame.isInCheck(this.currentPlayer)) {
                                    return false;
                                }
                            }
                        }
                    }
                }
            }
        }
        console.log('Checkmate confirmed');
        return true;
    }

    isStalemate() {
        if (this.isInCheck(this.currentPlayer)) return false;

        for (let fromRow = 0; fromRow < 8; fromRow++) {
            for (let fromCol = 0; fromCol < 8; fromCol++) {
                if (this.board[fromRow][fromCol]?.color === this.currentPlayer) {
                    for (let toRow = 0; toRow < 8; toRow++) {
                        for (let toCol = 0; toCol < 8; toCol++) {
                            if (this.isValidMove(fromRow, fromCol, toRow, toCol)) {
                                const tempBoard = JSON.parse(JSON.stringify(this.board));
                                const piece = tempBoard[fromRow][fromCol];
                                tempBoard[toRow][toCol] = piece;
                                tempBoard[fromRow][fromCol] = null;
                                if (piece.type === 'king' && Math.abs(toCol - fromCol) === 2) {
                                    const rookCol = toCol > fromCol ? 7 : 0;
                                    const rookToCol = toCol > fromCol ? fromCol + 1 : fromCol - 1;
                                    tempBoard[fromRow][rookToCol] = tempBoard[fromRow][rookCol];
                                    tempBoard[fromRow][rookCol] = null;
                                } else if (piece.type === 'pawn' && (toRow === 0 || toRow === 7)) {
                                    tempBoard[toRow][toCol] = { type: 'queen', color: piece.color };
                                }

                                const tempGame = new ChessGame(this.isSinglePlayer, false);
                                tempGame.board = tempBoard;
                                tempGame.currentPlayer = this.currentPlayer;
                                if (!tempGame.isInCheck(this.currentPlayer)) {
                                    return false;
                                }
                            }
                        }
                    }
                }
            }
        }
        console.log('Stalemate confirmed');
        return true;
    }

    // Evaluation function: scores the board from Black's perspective
    evaluateBoard() {
        const pieceValues = { pawn: 100, knight: 320, bishop: 330, rook: 500, queen: 900, king: 20000 };
        let score = 0;
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const piece = this.board[row][col];
                if (piece) {
                    const value = pieceValues[piece.type];
                    score += (piece.color === 'black' ? value : -value);
                }
            }
        }
        for (let col = 0; col < 8; col++) {
            const blackPawn = this.board[1][col];
            const whitePawn = this.board[6][col];
            if (blackPawn && blackPawn.type === 'pawn') score += (6 - 1) * 10;
            if (whitePawn && whitePawn.type === 'pawn') score -= (6 - 6) * 10;
        }
        return score;
    }

    makeAIMove() {
        if (this.gameOver || this.isRestarting || this.currentPlayer !== 'black') {
            console.log('AI move skipped: gameOver, isRestarting, or not Black\'s turn');
            return;
        }
        console.log('AI calculating move...');
    
        const moves = this.getAllMoves('black');
        if (moves.length === 0) {
            console.log('No moves available for AI');
            return;
        }
    
        let bestMove = null;
        let bestValue = -Infinity;
        const depth = 3;
    
        for (const move of moves) {
            const tempBoard = JSON.parse(JSON.stringify(this.board));
            const capturedPiece = this.board[move.toRow][move.toCol];
            this.makeMove(move.fromRow, move.fromCol, move.toRow, move.toCol, 'queen');
            const value = this.minimax(depth - 1, -Infinity, Infinity, false);
            this.board = tempBoard;
    
            if (value > bestValue) {
                bestValue = value;
                bestMove = move;
            }
        }
    
        if (bestMove) {
            console.log(`AI chose move: ${bestMove.fromRow},${bestMove.fromCol} to ${bestMove.toRow},${bestMove.toCol}`);
            const tempBoard = JSON.parse(JSON.stringify(this.board));
            const capturedPiece = this.board[bestMove.toRow][bestMove.toCol];
            const isCastling = this.board[bestMove.fromRow][bestMove.fromCol]?.type === 'king' && Math.abs(bestMove.fromCol - bestMove.toCol) === 2;
            const isEnPassant = this.board[bestMove.fromRow][bestMove.fromCol]?.type === 'pawn' && bestMove.toCol !== bestMove.fromCol && !capturedPiece;
    
            this.animateMove(bestMove.fromRow, bestMove.fromCol, bestMove.toRow, bestMove.toCol, capturedPiece ? 'capture' : 'move', () => {
                this.makeMove(bestMove.fromRow, bestMove.fromCol, bestMove.toRow, bestMove.toCol, 'queen');
                this.commitMove(bestMove.fromRow, bestMove.fromCol, bestMove.toRow, bestMove.toCol, tempBoard, capturedPiece, isCastling, isEnPassant);
            });
        } else {
            console.log('AI found no valid move');
        }
    }

    findBestMove(depth) {
        const pieces = [];
        for (let i = 0; i < 8; i++) {
            for (let j = 0; j < 8; j++) {
                if (this.board[i][j]?.color === 'black') {
                    pieces.push({ row: i, col: j });
                }
            }
        }
    
        let bestMove = null;
        let bestScore = -Infinity;
    
        for (const piece of pieces) {
            for (let i = 0; i < 8; i++) {
                for (let j = 0; j < 8; j++) {
                    if (this.isValidMove(piece.row, piece.col, i, j)) {
                        const tempBoard = JSON.parse(JSON.stringify(this.board));
                        const tempPiece = tempBoard[piece.row][piece.col];
                        const capturedPiece = tempBoard[i][j];
                        tempBoard[i][j] = tempPiece;
                        tempBoard[piece.row][piece.col] = null;
    
                        if (tempPiece.type === 'king' && Math.abs(j - piece.col) === 2) {
                            const rookCol = j > piece.col ? 7 : 0;
                            const rookToCol = j > piece.col ? piece.col + 1 : piece.col - 1;
                            tempBoard[piece.row][rookToCol] = tempBoard[piece.row][rookCol];
                            tempBoard[piece.row][rookCol] = null;
                        } else if (tempPiece.type === 'pawn' && i === 7) {
                            tempBoard[i][j] = { type: 'queen', color: 'black' };
                        } else if (tempPiece.type === 'pawn' && j !== piece.col && !capturedPiece && 
                                   this.enPassantTarget && i === this.enPassantTarget.row && j === this.enPassantTarget.col) {
                            tempBoard[this.enPassantTarget.row][this.enPassantTarget.col] = null;
                        }
    
                        const tempGame = new ChessGame(this.isSinglePlayer, false);
                        tempGame.board = tempBoard;
                        tempGame.currentPlayer = 'black';
                        tempGame.enPassantTarget = (tempPiece.type === 'pawn' && Math.abs(piece.row - i) === 2) 
                            ? { row: (piece.row + i) / 2, col: piece.col } : null;
    
                        if (!tempGame.isInCheck('black')) {
                            const score = tempGame.minimax(depth - 1, -Infinity, Infinity, false);
                            if (score > bestScore) {
                                bestScore = score;
                                bestMove = { 
                                    fromRow: piece.row, 
                                    fromCol: piece.col, 
                                    toRow: i, 
                                    toCol: j, 
                                    capturedPiece,
                                    isCastling: tempPiece.type === 'king' && Math.abs(j - piece.col) === 2,
                                    isEnPassant: tempPiece.type === 'pawn' && j !== piece.col && !capturedPiece && 
                                                this.enPassantTarget && i === this.enPassantTarget.row && j === this.enPassantTarget.col,
                                    score
                                };
                            }
                        }
                    }
                }
            }
        }
    
        return bestMove;
    }

    // Minimax with alpha-beta pruning
    minimax(depth, alpha, beta, maximizingPlayer) {
        if (depth === 0 || this.isCheckmate() || this.isStalemate()) {
            return this.evaluateBoard();
        }
        const moves = this.getAllMoves(maximizingPlayer ? 'black' : 'white');
        if (moves.length === 0) return this.evaluateBoard();

        if (maximizingPlayer) {
            let maxEval = -Infinity;
            for (const { fromRow, fromCol, toRow, toCol } of moves) {
                const tempBoard = JSON.parse(JSON.stringify(this.board));
                this.makeMove(fromRow, fromCol, toRow, toCol, 'queen');
                const evaluate = this.minimax(depth - 1, alpha, beta, false);
                this.board = tempBoard;
                maxEval = Math.max(maxEval, evaluate);
                alpha = Math.max(alpha, evaluate);
                if (beta <= alpha) break;
            }
            return maxEval;
        } else {
            let minEval = Infinity;
            for (const { fromRow, fromCol, toRow, toCol } of moves) {
                const tempBoard = JSON.parse(JSON.stringify(this.board));
                this.makeMove(fromRow, fromCol, toRow, toCol, 'queen');
                const evaluate = this.minimax(depth - 1, alpha, beta, true);
                this.board = tempBoard;
                minEval = Math.min(minEval, evaluate);
                beta = Math.min(beta, evaluate);
                if (beta <= alpha) break;
            }
            return minEval;
        }
    }

    setupEventListeners() {
        const restartButton = document.getElementById('restart');
        if (!restartButton) {
            console.error('Restart button not found in DOM');
            return;
        }
        restartButton.removeEventListener('click', this.restartHandler);
        this.restartHandler = () => {
            console.log('Restarting game...');
            this.isRestarting = true;

            if (this.aiMoveTimeout) {
                clearTimeout(this.aiMoveTimeout);
                this.aiMoveTimeout = null;
                console.log('AI move timeout cleared in restart');
            }

            this.board = this.initializeBoard();
            this.currentPlayer = 'white';
            this.selectedPiece = null;
            this.gameOver = false;
            this.moveHistory = [];
            this.moveNotation = [];
            this.hasMoved = { whiteKing: false, blackKing: false, whiteRooks: [false, false], blackRooks: [false, false] };
            this.enPassantTarget = null;
            this.isPromoting = false;
            this.lastMove = null;
            this.moveCount = 0;

            if (this.promotionContainer) {
                this.promotionContainer.remove();
                this.promotionContainer = null;
                console.log('Promotion container removed');
            }
            this.clearHighlights();

            this.renderBoard();
            this.isRestarting = false;

            setTimeout(() => {
                this.renderBoard();
                console.log('Game restarted successfully');
            }, 0);
        };
        restartButton.addEventListener('click', this.restartHandler);

        const undoButton = document.getElementById('undo');
        if (undoButton) {
            undoButton.addEventListener('click', () => this.undoMove());
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const singlePlayerButton = document.getElementById('single-player');
    if (singlePlayerButton) {
        singlePlayerButton.addEventListener('click', () => {
            console.log('Starting single player game');
            document.getElementById('welcome-screen').classList.add('hidden');
            document.getElementById('game-container').classList.remove('hidden');
            if (!window.currentGame) {
                window.currentGame = new ChessGame(true);
            } else {
                window.currentGame.restartHandler();
            }
        });
    } else {
        console.error('Single-player button not found in DOM');
    }

    document.getElementById('year').textContent = new Date().getFullYear();
});