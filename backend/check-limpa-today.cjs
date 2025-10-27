const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkLimpaToday() {
  const now = new Date();
  const offset = -3;
  now.setHours(now.getHours() + offset);
  
  const todayLocal = now.toISOString().split('T')[0];
  const startToday = new Date(`${todayLocal}T03:00:00.000Z`);
  const endToday = new Date(startToday);
  endToday.setDate(endToday.getDate() + 1);
  
  console.log('=== Verificando pesagens de roupa LIMPA de hoje:', todayLocal, '\n');
  
  // Buscar controles de roupa limpa de hoje
  const controls = await prisma.weighingControl.findMany({
    where: {
      kind: 'limpa',
      referenceDate: {
        gte: startToday,
        lt: endToday
      }
    },
    include: {
      entries: {
        orderBy: { createdAt: 'asc' }
      },
      client: true
    }
  });
  
  console.log(`Encontrados ${controls.length} controles de roupa limpa de hoje\n`);
  
  for (const control of controls) {
    console.log(`📋 Controle #${control.id} - ${control.client?.name || 'SEM CLIENTE'}`);
    console.log(`   Status: ${control.status}`);
    console.log(`   Peso bruto lavanderia: ${control.laundryGrossWeight}kg`);
    console.log(`   Total líquido cliente: ${control.clientTotalNetWeight}kg`);
    console.log(`   Diferença: ${control.differenceWeight}kg (${control.differencePercent}%)`);
    console.log(`   Total pesagens: ${control.entries.length}\n`);
    
    if (control.entries.length > 0) {
      console.log('📊 Pesagens por horário:\n');
      
      // Agrupar por horário
      const byHour = {};
      control.entries.forEach(entry => {
        const hour = entry.createdAt.getHours();
        if (!byHour[hour]) byHour[hour] = [];
        byHour[hour].push(entry);
      });
      
      Object.keys(byHour).sort().forEach(hour => {
        const entries = byHour[hour];
        const total = entries.reduce((sum, e) => sum + Number(e.netWeight), 0);
        console.log(`   ${hour}:00-${hour}:59 - ${entries.length} gaiolas (${total.toFixed(2)} kg)`);
        
        entries.forEach((entry, idx) => {
          console.log(`      [${idx + 1}] ID: ${entry.id}`);
          console.log(`          Total: ${entry.totalWeight}kg | Tara: ${entry.tareWeight}kg | Líquido: ${entry.netWeight}kg`);
          console.log(`          Criado: ${entry.createdAt.toISOString()}`);
        });
        console.log('');
      });
      
      // Verificar se há duplicatas por peso
      console.log('🔍 Verificando duplicatas por peso:\n');
      const byWeight = {};
      control.entries.forEach(entry => {
        const weight = entry.netWeight;
        if (!byWeight[weight]) byWeight[weight] = [];
        byWeight[weight].push(entry);
      });
      
      Object.keys(byWeight).forEach(weight => {
        const entries = byWeight[weight];
        if (entries.length > 1) {
          console.log(`   ⚠️  Peso ${weight}kg aparece ${entries.length} vezes:`);
          entries.forEach(entry => {
            console.log(`      ID: ${entry.id} | ${entry.createdAt.toISOString()}`);
          });
          console.log('');
        }
      });
      
      // Calcular total real
      const realTotal = control.entries.reduce((sum, e) => sum + Number(e.netWeight), 0);
      console.log(`📊 RESUMO:`);
      console.log(`   Total real das pesagens: ${realTotal.toFixed(2)}kg`);
      console.log(`   Total no controle: ${control.clientTotalNetWeight}kg`);
      console.log(`   Diferença: ${(realTotal - Number(control.clientTotalNetWeight)).toFixed(2)}kg\n`);
    }
  }
  
  // Verificar se há pesagens órfãs (sem controle)
  console.log('=== Verificando pesagens órfãs de roupa limpa de hoje...\n');
  
  const orphanEntries = await prisma.weighingEntry.findMany({
    where: {
      control: {
        kind: 'limpa',
        referenceDate: {
          gte: startToday,
          lt: endToday
        }
      },
      createdAt: {
        gte: startToday,
        lt: endToday
      }
    },
    include: {
      control: {
        include: {
          client: true
        }
      }
    },
    orderBy: { createdAt: 'asc' }
  });
  
  console.log(`Total de pesagens de roupa limpa de hoje: ${orphanEntries.length}\n`);
  
  if (orphanEntries.length > 0) {
    console.log('📋 Todas as pesagens de hoje (em ordem cronológica):\n');
    
    orphanEntries.forEach((entry, idx) => {
      console.log(`[${idx + 1}] ID: ${entry.id}`);
      console.log(`   Controle: ${entry.control.client?.name || 'SEM CLIENTE'} (${entry.control.kind})`);
      console.log(`   Total: ${entry.totalWeight}kg | Tara: ${entry.tareWeight}kg | Líquido: ${entry.netWeight}kg`);
      console.log(`   Criado: ${entry.createdAt.toISOString()}`);
      console.log(`   Status controle: ${entry.control.status}\n`);
    });
    
    const totalAll = orphanEntries.reduce((sum, e) => sum + Number(e.netWeight), 0);
    console.log(`📊 TOTAL GERAL: ${totalAll.toFixed(2)}kg de ${orphanEntries.length} pesagens\n`);
  }
}

checkLimpaToday()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
