// Working candidate list assembled from the conversation. Not a verified Google-rated directory.
// Coordinates are deliberately absent unless independently verified; never fabricate pins.
const RESTAURANTS = [
['Бирария Атила','Lozenets','Beerhouse'],['Balkan Grill Arkadia','Lozenets','Serbian'],['Бирария При Водната Кула','Lozenets','Beerhouse'],['Club 1857','Centre','Beerhouse'],['Luciano / Бирария Лучано','Centre','Beerhouse'],['Talpa Beerhouse','Geo Milev','Beerhouse'],['Sporko – The Garden of Rock','Geo Milev','Beerhouse'],['Stochna Kitchen Brewery','Orlandovtsi','Beerhouse'],['Dondukov Brewery','Centre','Beerhouse'],['SkaraBar 1','Zaimov','Grill'],['SkaraBar 2','Centre','Grill'],['The Thirsty Dragon Inn','Centre','Beerhouse'],['Ale House Lozenets','Lozenets','Beerhouse'],['The Three-Legged Chicken','Centre','Beerhouse'],["Tom's Place",'Centre','Beerhouse'],['Aubergine – Craft Beer. Craft Food.','Centre','Beerhouse'],['Бирария На Мегдана','Sofia','Beerhouse'],['Бирария Стамболовъ','Lozenets','Beerhouse'],['Halbite – Tri Ushi','Centre','Beerhouse'],['Prague 18 Family Pub','Centre','Beerhouse'],['Pub 5 Corners','Centre','Beerhouse'],['Die Alte Lampe','Lozenets','Beerhouse'],['Kafana Stefanovich','Lozenets','Serbian'],['Под Липите','Lozenets','Bulgarian'],['Хаджидрагановите изби','Centre','Bulgarian'],['Манастирска магерница','Centre','Bulgarian'],['Избата / Izbata Tavern','Centre','Bulgarian'],['Ракета Ракия Бар','Oborishte','Bulgarian'],['Царевеца','Centre','Bulgarian'],['Механа 681','Lozenets','Bulgarian'],['Balkan Express Serbian Cuisine','Centre','Serbian'],['Винарна Брани','Centre','Serbian'],['Скара при Гелето','Centre','Grill'],['Maraia Classic','Lozenets','Grill'],['Бирария При Миле','Sofia','Beerhouse'],['Ресторант Стефанович','Sofia','Serbian'],['Сръбски ресторант При Братовчеда','Sofia','Serbian'],['Сръбска скара Котилото','Sofia','Serbian'],['Kanaal','Centre','Beerhouse'],['Ale House Centre','Centre','Beerhouse']
].map(([name,area,type],i)=>({id:i+1,name,area,type,verified:false,rating:null,football:null,lat:null,lng:null}));
// A few independently known venue addresses from earlier research, but not exact geocoordinates.
const ADDRESSES = {
'Бирария Атила':'ул. Крум Попов 64, София',
'Balkan Grill Arkadia':'ул. Крум Попов 64, София',
'Бирария При Водната Кула':'ул. Свети Теодосий Търновски 60, София',
'Club 1857':'ул. Сан Стефано 22, София',
'Luciano / Бирария Лучано':'пл. Петко Р. Славейков 9, София',
'Talpa Beerhouse':'ул. Христо Чернопеев 5А, София',
'Dondukov Brewery':'бул. Княз Александър Дондуков 14, София',
'SkaraBar 1':'ул. Димитър Греков 2, София',
'SkaraBar 2':'ул. Георги Бенковски 12, София',
'Ale House Lozenets':'ул. Крум Попов 4, София',
'Aubergine – Craft Beer. Craft Food.':'ул. Карнеги 11, София',
'Бирария Стамболовъ':'бул. Свети Наум 1, София',
'Halbite – Tri Ushi':'ул. Три уши 13, София',
'Prague 18 Family Pub':'бул. Прага 18, София',
'Ale House Centre':'ул. Христо Белчев 42, София',
'Избата / Izbata Tavern':'ул. Славянска 18, София',
'Kafana Stefanovich':'ул. Златовръх 4, София'
};
