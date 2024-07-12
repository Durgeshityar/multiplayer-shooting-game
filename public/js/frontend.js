const canvas = document.querySelector('canvas')
const c = canvas.getContext('2d')

const socket = io()

const scoreEl = document.querySelector('#scoreEl')

const devicePixleRatio = window.devicePixelRatio || 1

canvas.width = innerWidth * devicePixleRatio
canvas.height = innerHeight * devicePixleRatio

const x = canvas.width / 2
const y = canvas.height / 2

// FE players
const frontEndPlayers = {}
const frontEndProjectiles = {}

socket.on('updatedProjectiles', (backEndProjectiles) => {
  for (const id in backEndProjectiles) {
    const backEndProjectile = backEndProjectiles[id]

    if (!frontEndProjectiles[id]) {
      frontEndProjectiles[id] = new Projectile({
        x: backEndProjectile.x,
        y: backEndProjectile.y,
        radius: 5,
        color: frontEndPlayers[backEndProjectile.playerId]?.color,
        velocity: backEndProjectile.velocity
      })
    } else {
      frontEndProjectiles[id].x += backEndProjectiles[id].velocity.x
      frontEndProjectiles[id].y += backEndProjectiles[id].velocity.y
    }
  }

  for (const frontEndProjectileId in frontEndProjectiles) {
    if (!backEndProjectiles[frontEndProjectileId]) {
      delete frontEndProjectiles[frontEndProjectileId]
    }
  }
})

socket.on('updatedPlayers', (backendPlayers) => {
  for (const id in backendPlayers) {
    const backendPlayer = backendPlayers[id]

    if (!frontEndPlayers[id]) {
      frontEndPlayers[id] = new Player({
        x: backendPlayer.x,
        y: backendPlayer.y,
        radius: 10,
        color: backendPlayer.color
      })

      document.querySelector(
        '#PlayerLabels'
      ).innerHTML += ` <div data-id="${id}" data-score="${backendPlayer?.score}"> ${backendPlayer.username} : ${backendPlayer?.score}</div>`
    } else {
      // showing score in FE
      document.querySelector(
        `div[data-id="${id}"]`
      ).innerHTML = `${backendPlayer.username} : ${backendPlayer?.score} `

      // sorting score
      document
        .querySelector(`div[data-id="${id}"]`)
        .setAttribute('data-score', backendPlayer.score)

      const parentDiv = document.querySelector('#PlayerLabels')
      const childDiv = Array.from(parentDiv.querySelectorAll('div'))

      childDiv.sort((a, b) => {
        const scoreA = Number(a.getAttribute('data-score'))
        const scoreB = Number(b.getAttribute('data-score'))
        return scoreB - scoreA
      })

      // removes old element
      childDiv.forEach((div) => {
        parentDiv.removeChild(div)
      })

      // adds sorted element
      childDiv.forEach((div) => {
        parentDiv.appendChild(div)
      })

      if (id === socket.id) {
        // if player exists
        frontEndPlayers[id].x = backendPlayer.x
        frontEndPlayers[id].y = backendPlayer.y

        const lastBEInputIndex = playerInputs.findIndex((input) => {
          return backendPlayer.sequenceNumber === input.sequenceNumber
        })

        if (lastBEInputIndex > -1) playerInputs.splice(0, lastBEInputIndex + 1)
        playerInputs.forEach((input) => {
          frontEndPlayers[id].x += input.dx
          frontEndPlayers[id].y += input.dy
        })
      } else {
        gsap.to(frontEndPlayers[id], {
          x: backendPlayer.x,
          y: backendPlayer.y,
          duration: 0.015,
          ease: 'linear'
        })
      }
    }
  }

  // This is where we delete front end players
  for (const id in frontEndPlayers) {
    if (!backendPlayers[id]) {
      const divToDelete = document.querySelector(`div[data-id="${id}"]`)
      divToDelete.parentNode.removeChild(divToDelete)

      if (id === socket.id) {
        document.querySelector('#usernameForm').style.display = 'block'
      }

      delete frontEndPlayers[id]
    }
  }
})

let animationId
let score = 0
function animate() {
  animationId = requestAnimationFrame(animate)
  c.fillStyle = 'rgba(0, 0, 0, 0.1)'
  c.fillRect(0, 0, canvas.width, canvas.height)

  for (const id in frontEndPlayers) {
    const player = frontEndPlayers[id]
    player.draw()
  }

  for (const id in frontEndProjectiles) {
    const frontEndProjectile = frontEndProjectiles[id]
    frontEndProjectile.draw()
  }
}

animate()

const keys = {
  w: { pressed: false },
  a: { pressed: false },
  s: { pressed: false },
  d: { pressed: false }
}

const SPEED = 10
const playerInputs = []
let sequenceNumber = 0

//  SERVER SIDE RECONCIALIATION - AVOIDS LAG
setInterval(() => {
  // not else if because we want to run it simultaneous;ly
  if (keys.w.pressed) {
    sequenceNumber++
    playerInputs.push({ sequenceNumber, dx: 0, dy: -SPEED })
    frontEndPlayers[socket.id].y -= SPEED
    socket.emit('keydown', { keycode: 'KeyW', sequenceNumber })
  }

  if (keys.a.pressed) {
    sequenceNumber++
    playerInputs.push({ sequenceNumber, dx: -SPEED, dy: 0 })
    frontEndPlayers[socket.id].x -= SPEED
    socket.emit('keydown', { keycode: 'KeyA', sequenceNumber })
  }

  if (keys.s.pressed) {
    sequenceNumber++
    playerInputs.push({ sequenceNumber, dx: 0, dy: SPEED })
    frontEndPlayers[socket.id].y += SPEED
    socket.emit('keydown', { keycode: 'KeyS', sequenceNumber })
  }

  if (keys.d.pressed) {
    sequenceNumber++
    playerInputs.push({ sequenceNumber, dx: SPEED, dy: 0 })
    frontEndPlayers[socket.id].x += SPEED
    socket.emit('keydown', { keycode: 'KeyD', sequenceNumber })
  }
}, 15)

window.addEventListener('keydown', (e) => {
  if (!frontEndPlayers[socket.id]) return // if player isnt loaded

  switch (e.code) {
    case 'KeyW':
      keys.w.pressed = true
      break

    case 'KeyA':
      keys.a.pressed = true
      break

    case 'KeyS':
      keys.s.pressed = true
      break

    case 'KeyD':
      keys.d.pressed = true
      break
  }
})

window.addEventListener('keyup', (e) => {
  if (!frontEndPlayers[socket.id]) return // if player isnt loaded

  switch (e.code) {
    case 'KeyW':
      keys.w.pressed = false

      break

    case 'KeyA':
      keys.a.pressed = false

      break

    case 'KeyS':
      keys.s.pressed = false

      break

    case 'KeyD':
      keys.d.pressed = false

      break
  }
})

document.querySelector('#usernameForm').addEventListener('submit', (e) => {
  e.preventDefault()

  document.querySelector('#usernameForm').style.display = 'none'

  socket.emit('initGame', {
    width: canvas.width,
    height: canvas.height,
    devicePixleRatio,
    username: document.querySelector('#usernameInput').value
  })
})
