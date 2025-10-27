// Script para corrigir datas de pesagens registradas no dia errado
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixTimezoneDates() {
  try {
    console.log('🔍 Procurando pesagens com data errada...\n');
    
    // Buscar todos os controles
    const controls = await prisma.weighingControl.findMany({
      orderBy: { createdAt: 'desc' }
    });
    
    const toFix = [];
    
    for (const control of controls) {
      const createdAt = new Date(control.createdAt);
      const refDate = new Date(control.referenceDate);
      
      // Converter createdAt para horário do Brasil (UTC-3)
      const brazilHour = new Date(createdAt.getTime() - (3 * 60 * 60 * 1000));
      const hour = brazilHour.getUTCHours();
      
      // Verificar se foi criado entre 21h e 23h59 (BRT)
      if (hour >= 21 && hour <= 23) {
        // Comparar as datas (sem hora)
        const createdDateStr = brazilHour.toISOString().split('T')[0];
        const refDateStr = refDate.toISOString().split('T')[0];
        
        // Se referenceDate está 1 dia depois do createdAt, está errado
        if (refDateStr > createdDateStr) {
          toFix.push({
            id: control.id,
            createdAt: createdAt.toISOString(),
            currentRefDate: refDate.toISOString(),
            hour: `${hour}h`,
            kind: control.kind
          });
        }
      }
    }
    
    console.log(`📊 Encontrados ${toFix.length} registros para corrigir:\n`);
    
    if (toFix.length > 0) {
      console.table(toFix.slice(0, 10)); // Mostrar primeiros 10
      
      console.log('\n🔧 Corrigindo...\n');
      
      let fixed = 0;
      for (const item of toFix) {
        const currentDate = new Date(item.currentRefDate);
        const correctedDate = new Date(currentDate.getTime() - (24 * 60 * 60 * 1000)); // Subtrair 1 dia
        
        await prisma.weighingControl.update({
          where: { id: item.id },
          data: { referenceDate: correctedDate }
        });
        
        fixed++;
      }
      
      console.log(`✅ ${fixed} registros corrigidos com sucesso!`);
    } else {
      console.log('✅ Nenhum registro precisa de correção!');
    }
    
  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixTimezoneDates();

