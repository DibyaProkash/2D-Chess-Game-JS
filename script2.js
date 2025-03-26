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
        this.whiteTime = 600;
        this.blackTime = 600;
        this.timerInterval = null;
        this.promotionContainer = null;
        this.possibleMoves = []; // Track possible moves
        this.setupEventListeners();
        if (render) {
            this.renderBoard();
            this.startTimer();
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
        console.log('Rendering board');
        const boardElement = document.getElementById('board');
        boardElement.innerHTML = '';

        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const square = document.createElement('div');
                square.className = `square ${(row + col) % 2 === 0 ? 'light' : 'dark'}`;
                square.dataset.row = row;
                square.dataset.col = col;

                const piece = this.board[row][col];
                if (piece) {
                    square.innerHTML = this.getPieceSymbol(piece);
                }

                // Apply highlights
                if (this.selectedPiece && this.selectedPiece.row === row && this.selectedPiece.col === col) {
                    square.classList.add('selected');
                }
                if (this.possibleMoves.some(move => move.row === row && move.col === col)) {
                    square.classList.add('possible-move');
                }

                square.addEventListener('click', () => this.handleSquareClick(row, col));
                boardElement.appendChild(square);
            }
        }

        const status = document.getElementById('status');
        if (this.gameOver) {
            status.classList.add('game-over');
            if (this.isCheckmate()) {
                const winner = this.currentPlayer === 'white' ? 'Black' : 'White';
                status.textContent = `Checkmate! ${winner} wins!`;
            } else if (this.isStalemate()) {
                status.textContent = 'Stalemate! Game is a draw.';
            } else if (this.whiteTime <= 0) {
                status.textContent = 'Time out! Black wins!';
            } else if (this.blackTime <= 0) {
                status.textContent = 'Time out! White wins!';
            }
        } else {
            status.classList.remove('game-over');
            status.textContent = `${this.currentPlayer}'s turn` + 
                (this.isInCheck(this.currentPlayer) ? ' - In Check!' : '');
        }

        const moveHistoryElement = document.getElementById('move-history');
        moveHistoryElement.innerHTML = this.moveNotation.map((move, i) => 
            `${Math.floor(i / 2) + 1}. ${i % 2 === 0 ? move : move + ' '}`).join('');

        const whiteTimer = document.getElementById('white-timer');
        const blackTimer = document.getElementById('black-timer');
        whiteTimer.textContent = this.formatTime(this.whiteTime);
        blackTimer.textContent = this.formatTime(this.blackTime);

        const undoButton = document.getElementById('undo');
        undoButton.disabled = this.moveHistory.length === 0 || this.gameOver;

        if (this.promotionContainer && (!this.selectedPiece || 
            !(this.board[this.selectedPiece.row][this.selectedPiece.col]?.type === 'pawn' && 
              (this.selectedPiece.row === 0 || this.selectedPiece.row === 7)))) {
            this.promotionContainer.remove();
            this.promotionContainer = null;
        }
    }

    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs < 10 ? '0' + secs : secs}`;
    }

    startTimer() {
        if (this.timerInterval) clearInterval(this.timerInterval);
        this.timerInterval = setInterval(() => {
            if (this.gameOver) {
                clearInterval(this.timerInterval);
                return;
            }
            if (this.currentPlayer === 'white') {
                this.whiteTime--;
                if (this.whiteTime <= 0) {
                    this.gameOver = true;
                    this.renderBoard();
                }
            } else {
                this.blackTime--;
                if (this.blackTime <= 0) {
                    this.gameOver = true;
                    this.renderBoard();
                }
            }
            this.renderBoard();
        }, 1000);
    }

    handleSquareClick(row, col) {
        if (this.gameOver) return;

        console.log(`Clicked: ${row},${col}`);
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

    showPromotionOptions(row, col, fromRow, fromCol, tempBoard, capturedPiece) {
        if (this.promotionContainer) {
            this.promotionContainer.remove();
        }
    
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
                this.renderBoard(); // Moved here
            };
        });
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
        this.clearHighlights();
        this.selectedPiece = null;

        if (this.isCheckmate()) {
            console.log('Checkmate detected');
            this.gameOver = true;
        } else if (this.isStalemate()) {
            console.log('Stalemate detected');
            this.gameOver = true;
        }

        this.renderBoard();

        if (this.isSinglePlayer && this.currentPlayer === 'black' && !this.gameOver) {
            setTimeout(() => this.makeAIMove(), 1000);
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

    isValidMove(fromRow, fromCol, toRow, toCol) {
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
                if (rowDiff === 0 && Math.abs(colDiff) === 2) {
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
            const tempGame = new ChessGame(this.isSinglePlayer, false);
            tempGame.board = tempBoard;
            if (tempGame.isInCheck(color)) return false;
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
        this.possibleMoves = []; // Reset possible moves

        for (let i = 0; i < 8; i++) {
            for (let j = 0; j < 8; j++) {
                if (this.isValidMove(row, col, i, j)) {
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
                    if (this.isValidMove(i, j, kingRow, kingCol)) {
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

    makeAIMove() {
        if (this.gameOver) return;

        console.log('AI turn');
        const pieces = [];
        for (let i = 0; i < 8; i++) {
            for (let j = 0; j < 8; j++) {
                if (this.board[i][j]?.color === 'black') {
                    pieces.push({ row: i, col: j });
                }
            }
        }

        const validMoves = [];
        for (const piece of pieces) {
            for (let i = 0; i < 8; i++) {
                for (let j = 0; j < 8; j++) {
                    if (this.isValidMove(piece.row, piece.col, i, j)) {
                        const tempBoard = JSON.parse(JSON.stringify(this.board));
                        const tempPiece = tempBoard[piece.row][piece.col];
                        tempBoard[i][j] = tempPiece;
                        tempBoard[piece.row][piece.col] = null;
                        if (tempPiece.type === 'king' && Math.abs(j - piece.col) === 2) {
                            const rookCol = j > piece.col ? 7 : 0;
                            const rookToCol = j > piece.col ? piece.col + 1 : piece.col - 1;
                            tempBoard[piece.row][rookToCol] = tempBoard[piece.row][rookCol];
                            tempBoard[piece.row][rookCol] = null;
                        } else if (tempPiece.type === 'pawn' && (i === 0 || i === 7)) {
                            tempBoard[i][j] = { type: 'queen', color: tempPiece.color };
                        }

                        const tempGame = new ChessGame(this.isSinglePlayer, false);
                        tempGame.board = tempBoard;
                        tempGame.currentPlayer = 'black';
                        if (!tempGame.isInCheck('black')) {
                            validMoves.push({ fromRow: piece.row, fromCol: piece.col, toRow: i, toCol: j });
                        }
                    }
                }
            }
        }

        if (validMoves.length > 0) {
            const move = validMoves[Math.floor(Math.random() * validMoves.length)];
            const capturedPiece = this.board[move.toRow][move.toCol];
            const tempBoard = JSON.parse(JSON.stringify(this.board));
            const isCastling = this.board[move.fromRow][move.fromCol].type === 'king' && Math.abs(move.fromCol - move.toCol) === 2;
            const isEnPassant = this.board[move.fromRow][move.fromCol].type === 'pawn' && 
                                move.toCol !== move.fromCol && !capturedPiece && 
                                this.enPassantTarget && move.toRow === this.enPassantTarget.row && move.toCol === this.enPassantTarget.col;

            this.makeMove(move.fromRow, move.fromCol, move.toRow, move.toCol);
            this.moveHistory.push({
                fromRow: move.fromRow, fromCol: move.fromCol,
                toRow: move.toRow, toCol: move.toCol,
                board: tempBoard,
                capturedPiece,
                currentPlayer: this.currentPlayer,
                enPassantTarget: this.enPassantTarget
            });
            this.addMoveNotation(move.fromRow, move.fromCol, move.toRow, move.toCol, capturedPiece, isCastling, isEnPassant);
            this.updateCastlingFlags(move.fromRow, move.fromCol, move.toRow, move.toCol);
            this.currentPlayer = 'white';

            if (this.isCheckmate()) {
                console.log('Checkmate detected');
                this.gameOver = true;
            } else if (this.isStalemate()) {
                console.log('Stalemate detected');
                this.gameOver = true;
            }

            this.renderBoard();
        } else {
            console.log('No valid moves for black');
            if (this.isInCheck('black')) {
                console.log('Checkmate for black');
                this.gameOver = true;
            } else {
                console.log('Stalemate for black');
                this.gameOver = true;
            }
            this.renderBoard();
        }
    }

    setupEventListeners() {
        document.getElementById('restart').addEventListener('click', () => {
            this.board = this.initializeBoard();
            this.currentPlayer = 'white';
            this.selectedPiece = null;
            this.gameOver = false;
            this.moveHistory = [];
            this.moveNotation = [];
            this.hasMoved = { whiteKing: false, blackKing: false, whiteRooks: [false, false], blackRooks: [false, false] };
            this.enPassantTarget = null;
            this.whiteTime = 600;
            this.blackTime = 600;
            if (this.promotionContainer) {
                this.promotionContainer.remove();
                this.promotionContainer = null;
            }
            this.clearHighlights();
            this.renderBoard();
            this.startTimer();
            console.log('Game restarted');
        });

        document.getElementById('undo').addEventListener('click', () => {
            this.undoMove();
        });
    }
}

document.getElementById('single-player').addEventListener('click', () => {
    console.log('Starting single player game');
    document.getElementById('welcome-screen').classList.add('hidden');
    document.getElementById('game-container').classList.remove('hidden');
    new ChessGame(true);
});

document.getElementById('year').textContent = new Date().getFullYear();