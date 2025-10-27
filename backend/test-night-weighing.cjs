const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testNightWeighing() {
  try {
    console.log('🌙 TESTANDO PESAGENS À NOITE\n');
    
    // Simular diferentes horários da noite
    const nightTimes = [
      { time: '2025-10-17T23:00:00.000Z', label: '20:00 BRT' },  // 20h
      { time: '2025-10-18T00:00:00.000Z', label: '21:00 BRT' },  // 21h
      { time: '2025-10-18T01:00:00.000Z', label: '22:00 BRT' },  // 22h
      { time: '2025-10-18T02:00:00.000Z', label: '23:00 BRT' },  // 23h
      { time: '2025-10-18T02:59:59.000Z', label: '23:59:59 BRT' },  // 23:59
      { time: '2025-10-18T03:00:00.000Z', label: '00:00 BRT (dia seguinte)' },  // 00:00 do dia 18
    ];
    
    console.log('🧪 SIMULANDO PESAGENS EM DIFERENTES HORÁRIOS DA NOITE:\n');
    
    nightTimes.forEach(({ time, label }) => {
      const now = new Date(time);
      const nowBRT = now.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
      
      // Simular o código do backend
      const todayBrazil = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
      const todayLocal = `${todayBrazil.getFullYear()}-${String(todayBrazil.getMonth() + 1).padStart(2, '0')}-${String(todayBrazil.getDate()).padStart(2, '0')}`;
      
      const referenceDate = new Date(`${todayLocal}T03:00:00.000Z`);
      const refBRT = referenceDate.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' });
      const nowDay = now.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' });
      
      console.log(`⏰ ${label}`);
      console.log(`   Hora UTC: ${now.toISOString()}`);
      console.log(`   Hora BRT: ${nowBRT}`);
      console.log(`   todayLocal calculado: ${todayLocal}`);
      console.log(`   referenceDate: ${referenceDate.toISOString()}`);
      console.log(`   Pesagem feita em: ${nowDay}`);
      console.log(`   Aparecerá na tabela em: ${refBRT}`);
      
      if (refBRT === nowDay) {
        console.log(`   ✅ CORRETO! Pesagem aparece no mesmo dia\n`);
      } else {
        console.log(`   ❌ ERRO! Pesagem de ${nowDay} aparece em ${refBRT}\n`);
      }
    });
    
    console.log('\n📋 RESUMO DA REGRA ATUAL:\n');
    console.log('✅ Pesagens das 00:00 até 23:59:59 BRT do dia 17');
    console.log('   → Aparecem na tabela do dia 17\n');
    console.log('✅ Pesagens a partir de 00:00 BRT do dia 18');
    console.log('   → Aparecem na tabela do dia 18\n');
    
    console.log('🔍 REGRA APLICADA:');
    console.log('   A pesagem aparece no dia que foi REALMENTE pesada');
    console.log('   Não importa o horário (21h, 23h, etc)');
    console.log('   O que importa é a data no horário de Brasília\n');
    
  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testNightWeighing();
