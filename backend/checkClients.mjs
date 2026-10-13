import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
prisma.client.findMany({ select: { id: true, firstName: true, lastName: true, phone: true } })
  .then(clients => {
    console.log('Found', clients.length, 'clients:');
    clients.forEach(c => {
      console.log('  ID:', c.id);
      console.log('  Name:', c.firstName, c.lastName);
      console.log('  Phone:', c.phone);
      console.log('---');
    });
  })
  .catch(err => console.error('Error:', err))
  .finally(() => prisma.$disconnect());
