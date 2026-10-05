/* The five dishes. To change a dish: swap the photo in assets/photos/,
   edit the lists below, and reload. Everything the students see comes from here. */
const DISHES = [
  { name:"Fresh spring rolls (gỏi cuốn)", photo:"assets/photos/spring-rolls.jpg",
    origin:["Vietnamese"], originWrong:["Italian","Mexican","Greek"],
    ingr:["shrimp","rice paper","fresh herbs","lettuce"], ingrWrong:["cheese","beef","potatoes"],
    type:["Appetizer"], typeWrong:["Main dish","Side dish","Dessert"],
    prep:["fresh (no cooking)","boiled"], prepWrong:["baked","grilled","pickled"] },
  { name:"Beef tacos", photo:"assets/photos/tacos.jpg",
    origin:["Mexican"], originWrong:["Thai","Japanese","French"],
    ingr:["beef","tortilla","tomatoes","lettuce"], ingrWrong:["mango","rice paper","noodles"],
    type:["Main dish"], typeWrong:["Appetizer","Side dish","Dessert"],
    prep:["fried"], prepWrong:["steamed","chilled","pickled"] },
  { name:"Greek salad", photo:"assets/photos/greek-salad.jpg",
    origin:["Greek"], originWrong:["Korean","Indian","Vietnamese"],
    ingr:["cucumber","tomatoes","feta cheese","olives","red onion"], ingrWrong:["beef","mango","noodles"],
    type:["Side dish"], typeWrong:["Main dish","Dessert","Appetizer"],
    prep:["fresh (no cooking)"], prepWrong:["fried","baked","boiled"] },
  { name:"Mango sticky rice", photo:"assets/photos/mango-sticky-rice.jpg",
    origin:["Thai"], originWrong:["Italian","Mexican","American"],
    ingr:["mango","sticky rice","coconut milk"], ingrWrong:["beef","onion","potatoes"],
    type:["Dessert"], typeWrong:["Appetizer","Main dish","Side dish"],
    prep:["steamed"], prepWrong:["grilled","pickled","fried"] },
  { name:"Margherita pizza", photo:"assets/photos/pizza.jpg",
    origin:["Italian"], originWrong:["Japanese","Moroccan","Korean"],
    ingr:["cheese","tomatoes","basil","dough"], ingrWrong:["shrimp","mango","kimchi"],
    type:["Main dish"], typeWrong:["Dessert","Side dish","Appetizer"],
    prep:["baked"], prepWrong:["steamed","fresh (no cooking)","pickled"] }
];

/* Options are shuffled with a fixed seed, so every device shows them in the same order. */
function shuffle(a, seed){
  const r = [...a];
  for(let i = r.length - 1; i > 0; i--){
    seed = (seed * 9301 + 49297) % 233280;
    const j = Math.floor(seed / 233280 * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}
function section(title, hint, right, wrong, seed){
  const options = shuffle([...right, ...wrong], seed);
  return { title, hint, options, correct:options.map((o, i) => right.includes(o) ? i : -1).filter(i => i >= 0) };
}
const QUESTIONS = DISHES.map((d, n) => ({
  dish:d,
  sections:[
    section("Where is it from?", "country", d.origin, d.originWrong, n * 11 + 1),
    section("What is in it?", "choose every ingredient you can see", d.ingr, d.ingrWrong, n * 11 + 2),
    section("What type of dish is it?", "course", d.type, d.typeWrong, n * 11 + 3),
    section("How is it prepared?", "way of cooking", d.prep, d.prepWrong, n * 11 + 4)
  ]
}));
const MAX_PER_DISH = 1000;
const MAX_POINTS = QUESTIONS.length * MAX_PER_DISH;
const TIMES = [45, 60, 90, 120];
