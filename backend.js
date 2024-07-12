const express = require('express')
const app = express()
const port = 3000

const http = require('http')
const server = http.createServer(app)

const { Server } = require('socket.io')
const io = new Server(server, { pingInterval: 2000, pingTimeout: 5000 }) // Ping timeout

app.use(express.static('public'))

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html')
})

const backEndPlayers = {}
const backEndProjectiles = {}

const SPEED = 10
const RADIUS = 10

let projectileId = 0

io.on('connection', (socket) => {
  io.emit('updatedPlayers', backEndPlayers)

  socket.on('shoot', ({ x, y, angle }) => {
    projectileId++

    const velocity = {
      x: Math.cos(angle) * 5,
      y: Math.sin(angle) * 5
    }

    backEndProjectiles[projectileId] = {
      x,
      y,
      velocity,
      playerId: socket.id
    }
  })

  socket.on('keydown', ({ keycode, sequenceNumber }) => {
    backEndPlayers[socket.id].sequenceNumber = sequenceNumber
    switch (keycode) {
      case 'KeyW':
        backEndPlayers[socket.id].y -= SPEED
        break

      case 'KeyA':
        backEndPlayers[socket.id].x -= SPEED
        break

      case 'KeyS':
        backEndPlayers[socket.id].y += SPEED
        break

      case 'KeyD':
        backEndPlayers[socket.id].x += SPEED
        break
    }
  })

  socket.on('initGame', ({ width, height, devicePixleRatio, username }) => {
    backEndPlayers[socket.id] = {
      x: 500 * Math.random(),
      y: 500 * Math.random(),
      color: `hsl(${Math.random() * 360}, 100%, 50%)`,
      sequenceNumber: 0,
      score: 0,
      username
    }

    backEndPlayers[socket.id].canvas = {
      width,
      height
    }

    // init canvas
    backEndPlayers[socket.id].radius = RADIUS

    if (devicePixleRatio > 1) {
      backEndPlayers[socket.id].radius = 2 * RADIUS
    }
  })

  socket.on('disconnect', (reason) => {
    console.log(reason)
    delete backEndPlayers[socket.id]
    io.emit('updatedPlayers', backEndPlayers)
  })
})

// to track movements 1000/15ms = 66.66 frame rate  -> TICK RATE
setInterval(() => {
  //update projectiles position

  for (const id in backEndProjectiles) {
    backEndProjectiles[id].x += backEndProjectiles[id].velocity.x
    backEndProjectiles[id].y += backEndProjectiles[id].velocity.y

    const PROJECTILE_RADIUS = 5
    if (
      backEndProjectiles[id].x - PROJECTILE_RADIUS >=
        backEndPlayers[backEndProjectiles[id]?.playerId]?.canvas?.width ||
      backEndProjectiles[id].x + PROJECTILE_RADIUS <= 0 ||
      backEndProjectiles[id].y - PROJECTILE_RADIUS >=
        backEndPlayers[backEndProjectiles[id]?.playerId]?.canvas?.height ||
      backEndProjectiles[id].y + PROJECTILE_RADIUS <= 0
    ) {
      delete backEndProjectiles[id]
      continue
    }
    for (const playerId in backEndPlayers) {
      const backEndPlayer = backEndPlayers[playerId]

      const DISTANCE = Math.hypot(
        backEndProjectiles[id].x - backEndPlayer.x,
        backEndProjectiles[id].y - backEndPlayer.y
      )

      // collision detection

      if (
        DISTANCE < PROJECTILE_RADIUS + backEndPlayer.radius &&
        backEndProjectiles[id].playerId !== playerId
      ) {
        if (backEndPlayers[backEndProjectiles[id].playerId])
          backEndPlayers[backEndProjectiles[id].playerId].score++

        delete backEndProjectiles[id]
        delete backEndPlayers[playerId]
        break
      }
    }
  }
  io.emit('updatedProjectiles', backEndProjectiles)
  io.emit('updatedPlayers', backEndPlayers)
}, 15)

server.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})

console.log('server loaded')