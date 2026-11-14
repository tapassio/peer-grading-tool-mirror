// Fixed test data, shared by the seed script and the tests.
module.exports = {
  admin: {
    email: 'ada@example.ch',
    password: 'E2e-Passw0rd!',
    firstName: 'Ada',
    lastName: 'Test',
  },
  // a running campaign with one group of three peers
  campaign: { name: 'E2E Kampagne', maxPoints: 6, criteria: ['Qualität'] },
  peers: [
    { firstName: 'Anna', lastName: 'Aebi', email: 'anna@students.example.org', link: 'e2e-link-anna-aaaaaaaaaaaaaaaaaaaaaaaaaaaa' },
    { firstName: 'Ben', lastName: 'Bucher', email: 'ben@students.example.org', link: 'e2e-link-ben-bbbbbbbbbbbbbbbbbbbbbbbbbbbbb' },
    { firstName: 'Cla', lastName: 'Caflisch', email: 'cla@students.example.org', link: 'e2e-link-cla-ccccccccccccccccccccccccccccc' },
  ],
};
