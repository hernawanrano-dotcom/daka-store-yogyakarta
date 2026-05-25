// Update onModuleInit - tambahkan POS
onModuleInit() {
  this.logger.log('Initializing Courier Registry...');

  // Register semua adapter yang sudah selesai
  this.registerAdapter(this.jntAdapter.getName(), this.jntAdapter);
  this.registerAdapter(this.dakaSamedayAdapter.getName(), this.dakaSamedayAdapter);
  this.registerAdapter(this.dakaInstantAdapter.getName(), this.dakaInstantAdapter);
  this.registerAdapter(this.heronaAdapter.getName(), this.heronaAdapter);
  this.registerAdapter(this.gojekAdapter.getName(), this.gojekAdapter);
  this.registerAdapter(this.grabAdapter.getName(), this.grabAdapter);
  
  // ✅ POS INDONESIA - SUDAH DIREGISTER
  this.registerAdapter(this.posAdapter.getName(), this.posAdapter);

  this.logger.log(`Courier Registry initialized with ${this.adapters.size} couriers: ${this.getAvailableCouriers().join(', ')}`);
}