import http from 'k6/http';
import { check, sleep } from 'k6';
import { randomItem } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';

const FOOD_QUERIES = [
  "McDonald's Big Mac",
  "McDonald's McDouble no cheese",
  "McDonald's large french fries",
  "McDonald's McChicken sandwich",
  "Chick-fil-A original chicken sandwich",
  "Chick-fil-A spicy deluxe sandwich",
  "Chick-fil-A 8 piece nuggets",
  "Chick-fil-A waffle fries medium",
  "Chipotle chicken burrito bowl",
  "Chipotle steak tacos three",
  "Chipotle carnitas burrito",
  "Chipotle sofritas bowl white rice",
  "Domino's hand tossed cheese pizza slice",
  "Domino's pepperoni thin crust slice",
  "Domino's brooklyn style supreme pizza",
  "Subway 6 inch turkey breast",
  "Subway footlong meatball marinara",
  "Subway spicy italian footlong",
  "Starbucks grande caramel macchiato",
  "Starbucks venti cold brew unsweetened",
  "Starbucks grande pumpkin spice latte",
  "Starbucks iced white chocolate mocha grande",
  "Panda Express orange chicken",
  "Panda Express beijing beef",
  "Panda Express honey walnut shrimp",
  "Raising Cane's chicken fingers 3 piece",
  "Raising Cane's box combo",
  "Quest chocolate chip cookie dough bar",
  "Quest peanut butter chocolate chip bar",
  "Quest birthday cake protein bar",
  "Premier Protein chocolate shake",
  "Premier Protein vanilla caramel shake",
  "Fairlife chocolate protein shake",
  "Fairlife core power elite vanilla 42g",
  "Panera bread broccoli cheddar soup bowl",
  "Panera bread fuji apple chicken salad",
  "Five Guys bacon cheeseburger",
  "Five Guys little hamburger",
  "Wingstop lemon pepper wings 10 piece",
  "Wingstop original hot wings 10 piece",
  "Whataburger double meat whataburger",
  "Whataburger patty melt",
  "Popeyes spicy chicken sandwich",
  "Popeyes 3 piece chicken tenders",
  "Shake Shack shackburger",
  "Shake Shack smoke shack burger",
  "Qdoba chicken burrito",
  "Taco Bell crunchwrap supreme",
  "Taco Bell chalupa supreme chicken",
  "Wendy's dave's double",
  "Wendy's spicy chicken sandwich",
  "Burger King whopper",
  "Burger King impossible whopper",
  "Sonic double cheeseburger",
  "Jersey Mike's turkey sub regular",
  "Jimmy John's italian night club",
  "Zaxby's signature chicken sandwich",
  "Cook Out double cheeseburger tray",
  "In-N-Out double double",
  "In-N-Out animal style fries",
  "Habit Burger charburger with cheese",
  "Culver's butterburger with cheese",
  "Hardee's thickburger original",
  "Carl's Jr western bacon cheeseburger",
  "Del Taco epic stuffed burrito",
  "Jack in the Box ultimate cheeseburger",
];

export const options = {
  stages: [
    { duration: '30s', target: 500 },
    { duration: '1m', target: 500 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'],
    http_req_failed: ['rate<0.01'],
  },
};

export default function () {
  const query = encodeURIComponent(randomItem(FOOD_QUERIES));
  const res = http.get(`${BASE_URL}/api/food/search?q=${query}`, {
    headers: {
      Authorization: 'Bearer fake-load-test-token',
    },
  });

  check(res, {
    'auth or ok not crash': (r) => r.status === 200 || r.status === 401,
    'not a crash': (r) => r.status !== 500,
  });

  sleep(0.5);
}
