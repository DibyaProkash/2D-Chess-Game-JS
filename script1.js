class ChessGame {
    constructor(isSinglePlayer, render = true) { // Added render flag to control rendering
        this.isSinglePlayer = isSinglePlayer;
        this.board = this.initializeBoard();
        this.currentPlayer = 'white';
        this.selectedPiece = null;
        this.gameOver = false;
        this.setupEventListeners();
        if (render) this.renderBoard(); // Only render if explicitly requested
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

                square.addEventListener('click', () => this.handleSquareClick(row, col));
                boardElement.appendChild(square);
            }
        }

        const status = document.getElementById('status');
        if (this.gameOver) {
            if (this.isCheckmate()) {
                status.textContent = `Checkmate! ${this.currentPlayer === 'white' ? 'Black' : 'White'} wins!`;
            } else if (this.isStalemate()) {
                status.textContent = 'Stalemate! Game is a draw.';
            }
        } else {
            status.textContent = `${this.currentPlayer}'s turn` + 
                (this.isInCheck(this.currentPlayer) ? ' - In Check!' : '');
        }
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
                this.makeMove(fromRow, fromCol, row, col);

                if (this.isInCheck(this.currentPlayer)) {
                    console.log('Move puts king in check, reverting');
                    this.board = tempBoard;
                } else {
                    console.log('Move successful');
                    this.currentPlayer = this.currentPlayer === 'white' ? 'black' : 'white';
                    this.clearHighlights();
                    this.selectedPiece = null;
                    this.renderBoard();

                    if (this.isCheckmate()) {
                        console.log('Checkmate detected');
                        this.gameOver = true;
                    } else if (this.isStalemate()) {
                        console.log('Stalemate detected');
                        this.gameOver = true;
                    }

                    if (this.isSinglePlayer && this.currentPlayer === 'black' && !this.gameOver) {
                        setTimeout(() => this.makeAIMove(), 1000);
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
        }
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
                         (piece.color === 'black' && fromRow === 1))) return true;
                }
                if (Math.abs(colDiff) === 1 && rowDiff === direction && 
                    this.board[toRow][toCol] && 
                    this.board[toRow][toCol].color !== piece.color) return true;
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
                return Math.abs(rowDiff) <= 1 && Math.abs(colDiff) <= 1;
        }
        return false;
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
        const selectedSquare = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
        if (selectedSquare) {
            selectedSquare.classList.add('selected');
            console.log(`Highlighting for ${row},${col}`);
        } else {
            console.error(`Selected square not found at ${row},${col}`);
        }

        for (let i = 0; i < 8; i++) {
            for (let j = 0; j < 8; j++) {
                if (this.isValidMove(row, col, i, j)) {
                    const tempBoard = JSON.parse(JSON.stringify(this.board));
                    const piece = tempBoard[row][col];
                    tempBoard[i][j] = piece;
                    tempBoard[row][col] = null;

                    const tempGame = new ChessGame(this.isSinglePlayer, false); // No render
                    tempGame.board = tempBoard;
                    if (!tempGame.isInCheck(this.currentPlayer)) {
                        const square = document.querySelector(`[data-row="${i}"][data-col="${j}"]`);
                        if (square) {
                            square.classList.add('possible-move');
                            console.log(`Highlighting possible move: ${i},${j}`);
                        } else {
                            console.error(`Possible move square not found at ${i},${j}`);
                        }
                    }
                }
            }
        }
    }

    clearHighlights() {
        document.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'));
        document.querySelectorAll('.possible-move').forEach(el => el.classList.remove('possible-move'));
    }

    makeMove(fromRow, fromCol, toRow, toCol) {
        console.log(`Making move from ${fromRow},${fromCol} to ${toRow},${toCol}`);
        this.board[toRow][toCol] = this.board[fromRow][fromCol];
        this.board[fromRow][fromCol] = null;

        if (this.board[toRow][toCol]?.type === 'pawn' && (toRow === 0 || toRow === 7)) {
            this.board[toRow][toCol].type = 'queen';
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

        console.log(`Checking for checkmate for ${this.currentPlayer}`);
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

                                const tempGame = new ChessGame(this.isSinglePlayer, false); // No render
                                tempGame.board = tempBoard;
                                if (!tempGame.isInCheck(this.currentPlayer)) {
                                    console.log(`Escape found: ${fromRow},${fromCol} to ${toRow},${toCol}`);
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

        console.log(`Checking for stalemate for ${this.currentPlayer}`);
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

                                const tempGame = new ChessGame(this.isSinglePlayer, false); // No render
                                tempGame.board = tempBoard;
                                if (!tempGame.isInCheck(this.currentPlayer)) {
                                    console.log(`Legal move found: ${fromRow},${fromCol} to ${toRow},${toCol}`);
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

                        const tempGame = new ChessGame(this.isSinglePlayer, false); // No render
                        tempGame.board = tempBoard;
                        if (!tempGame.isInCheck('black')) {
                            validMoves.push({ fromRow: piece.row, fromCol: piece.col, toRow: i, toCol: j });
                        }
                    }
                }
            }
        }

        if (validMoves.length > 0) {
            let move;
            if (this.isInCheck('black')) {
                console.log('Black in check, looking for escape');
                move = validMoves.find(m => {
                    const tempBoard = JSON.parse(JSON.stringify(this.board));
                    this.makeMove(m.fromRow, m.fromCol, m.toRow, m.toCol);
                    const stillInCheck = this.isInCheck('black');
                    this.board = tempBoard;
                    return !stillInCheck;
                }) || validMoves[Math.floor(Math.random() * validMoves.length)];
            } else {
                move = validMoves[Math.floor(Math.random() * validMoves.length)];
            }

            this.makeMove(move.fromRow, move.fromCol, move.toRow, move.toCol);
            this.currentPlayer = 'white';
            this.renderBoard();

            if (this.isCheckmate()) {
                console.log('Checkmate detected');
                this.gameOver = true;
            } else if (this.isStalemate()) {
                console.log('Stalemate detected');
                this.gameOver = true;
            }
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
            this.clearHighlights();
            this.renderBoard();
            console.log('Game restarted');
        });
    }
}

document.getElementById('single-player').addEventListener('click', () => {
    console.log('Starting single player game');
    document.getElementById('welcome-screen').classList.add('hidden');
    document.getElementById('game-container').classList.remove('hidden');
    new ChessGame(true); // Default render is true
});