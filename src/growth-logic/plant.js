let plants = ['Orchid', 'Daisy', 'Tulip', 'Sunflower', 'Rose', 'Daffodil',
          
          'Daisy','Peony', 'Sunflower', 'Calla lily', 'Dahlia', 'Iris',

          'Lavender', 'Marigold', 'Snapdragon', 'Agapanthus', 'Allium',

          'Azalea', 'Begonia', 'Delphinium', 'Transvaal daisy'];

class Flower {
  constructor(name, plantId, type, scientificName = '', growthCap = 100, growthRate = 2, funFact) {
    this.plantId = "f" + plantId;
    this.name = name;
    this.scientificName = scientificName;
    this.growth = 0;
    this.growthCap = growthCap;
    this.growthRate = growthRate;
    this.watered = false;
    this.funFact = funFact;
  }
  toDict() {
    return {
      "plantId": this.plantId,
      "type": this.type,
      "scientificName": this.scientificName,
      "growth": this.growth,
      "growthCap": this.growthCap,
      "growthRate": this.growthRate,
      "watered": this.watered,
      "funFact": this.funFact 
    };
  }
}

// Create a flower object for each plant
let flowerObjects = plants.map((name, plantId) => {
  return new Flower(name, plantId, "Flower");
});

// Convert each flower to a dictionary (object literal)
let flowerDicts = flowerObjects.map(flower => flower.toDict());

// Log them all out
console.log(flowerDicts);
  //console.log(JSON.stringify(dict_plants, null, 2));
export default flowerDicts;

