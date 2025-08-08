// server/index.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

/**
 * Very simple in-memory store for demo:
 * - drivers: { driverId: { socketId, location: {lat,lng}, available } }
 * - riders: { riderId: { socketId } }
 * In production use a DB + geo-indexing (Postgres + PostGIS, Redis geo, etc.)
 */
const drivers = {};
const riders = {};

// Utility: Haversine distance (km)
function haversineKm(a, b){
  const toRad = (v) => (v * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const sinDLat = Math.sin(dLat/2);
  const sinDLon = Math.sin(dLon/2);
  const aCalc = sinDLat*sinDLat + sinDLon*sinDLon * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(aCalc), Math.sqrt(1-aCalc));
  return R * c;
}

io.on('connection', (socket) => {
  console.log('socket connected', socket.id);

  // Register user (driver or rider)
  socket.on('register', ({ userId, role }) => {
    if (role === 'driver') {
      drivers[userId] = drivers[userId] || {};
      drivers[userId].socketId = socket.id;
      drivers[userId].available = true;
      console.log('driver registered', userId);
    } else {
      riders[userId] = riders[userId] || {};
      riders[userId].socketId = socket.id;
      console.log('rider registered', userId);
    }
  });

  // Driver sends location updates
  socket.on('driverLocation', ({ driverId, location }) => {
    if (!drivers[driverId]) drivers[driverId] = {};
    drivers[driverId].location = location;
    drivers[driverId].socketId = socket.id;
    // Broadcast to all riders: simplified
    io.emit('driverLocationUpdate', { driverId, location });
  });

  // Rider sends own location updates (optional)
  socket.on('riderLocation', ({ riderId, location }) => {
    if (!riders[riderId]) riders[riderId] = {};
    riders[riderId].location = location;
    riders[riderId].socketId = socket.id;
  });

  // Rider requests a ride: naive nearest-driver search
  socket.on('requestRide', ({ riderId, pickup, destination, rideId }) => {
    console.log('ride requested', riderId, pickup, destination);

    // find nearest available driver
    let best = null;
    let bestDist = Infinity;
    Object.entries(drivers).forEach(([dId, d]) => {
      if (!d.available || !d.location) return;
      const dist = haversineKm(pickup, d.location);
      if (dist < bestDist) {
        bestDist = dist;
        best = { driverId: dId, socketId: d.socketId, location: d.location, dist };
      }
    });

    if (!best) {
      // no drivers available
      const riderSocket = riders[riderId]?.socketId;
      if (riderSocket) io.to(riderSocket).emit('noDriversAvailable', { rideId });
      return;
    }

    // mark driver unavailable
    drivers[best.driverId].available = false;

    // Compose assignment payload
    const assignment = {
      rideId,
      riderId,
      driverId: best.driverId,
      driverLocation: best.location,
      etaMin: Math.round(best.dist * 3) + 1 // toy ETA: dist*3 minutes
    };

    // Emit to rider and driver
    const riderSocket = riders[riderId]?.socketId;
    if (riderSocket) io.to(riderSocket).emit('rideAssigned', assignment);
    if (best.socketId) io.to(best.socketId).emit('rideAccepted', assignment);

    console.log('assigned driver', assignment);
  });

  // Driver can accept or complete
  socket.on('driverUpdate', ({ driverId, rideId, status }) => {
    // status: 'arriving', 'picked', 'completed'
    // Notify rider
    // find rider from assignment — in this simple demo we broadcast
    io.emit('driverStatusUpdate', { driverId, rideId, status });
    if (status === 'completed' && drivers[driverId]) drivers[driverId].available = true;
  });

  socket.on('disconnect', () => {
    console.log('socket disconnected', socket.id);
    // clean up driver or rider by socket id
    Object.entries(drivers).forEach(([id, d]) => {
      if (d.socketId === socket.id) delete drivers[id];
    });
    Object.entries(riders).forEach(([id, r]) => {
      if (r.socketId === socket.id) delete riders[id];
    });
  });
});

app.get('/', (req, res) => res.send('Primer backend running'));
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log('Server listening on', PORT));
