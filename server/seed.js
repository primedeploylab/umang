const bcrypt = require('bcryptjs');
const Admin = require('./models/Admin');
const Category = require('./models/Category');

const seedAdmin = async () => {
  try {
    const existingAdmin = await Admin.findOne({ dmartCode: '3938' });
    if (!existingAdmin) {
      const passwordHash = await bcrypt.hash('Admin@123', 10);
      await Admin.create({ 
        username: 'admin@dmart.com', 
        passwordHash,
        dmartCode: '3938'
      });
      console.log('Default admin created: DMart 3938 / admin@dmart.com / Admin@123');
    }
  } catch (error) {
    console.error('Error seeding admin:', error);
  }
};

const seedCategories = async (dmartCode = '3938') => {
  const defaultDepartments = ['Core', 'Non-core', 'Officer', 'Facilities', 'Housekeeping', 'Cash Staff', 'GRN/Godown'];
  const defaultShifts = ['Full-Time', 'Part-Time'];

  try {
    for (const name of defaultDepartments) {
      await Category.findOneAndUpdate(
        { name, type: 'department', dmartCode },
        { name, type: 'department', dmartCode },
        { upsert: true }
      );
    }
    for (const name of defaultShifts) {
      await Category.findOneAndUpdate(
        { name, type: 'shift', dmartCode },
        { name, type: 'shift', dmartCode },
        { upsert: true }
      );
    }
    console.log(`Categories seeded for DMart ${dmartCode}`);
  } catch (error) {
    console.error('Error seeding categories:', error);
  }
};

module.exports = { seedAdmin, seedCategories };
