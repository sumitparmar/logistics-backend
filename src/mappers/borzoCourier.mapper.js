const mapCourierFromBorzo = (borzoCourier) => {
  if (!borzoCourier) return null;

  return {
    courierId: borzoCourier.courier_id,
    name: borzoCourier.name,
    surname: borzoCourier.surname,
    phone: borzoCourier.phone,
    photoUrl: borzoCourier.photo_url || null,

    location: {
      lat: borzoCourier.latitude || null,
      lng: borzoCourier.longitude || null,
    },
  };
};

module.exports = { mapCourierFromBorzo };
