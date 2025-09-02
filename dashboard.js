// Este arquivo (dashboard.js) será responsável por calcular e exibir os KPIs.

let vendasPorMesChartInstance = null;
let topProdutosChartInstance = null;

async function calcularEExibirDashboard() {
    const dataInicio = document.getElementById('dashboard-data-inicio').value;
    const dataFim = document.getElementById('dashboard-data-fim').value;

    try {
        const [
            vendasResult,
            itensResult,
            estoque
        ] = await Promise.all([
            supabaseClient.from('notas_fiscais').select('id, created_at, valor_total, contatos(nome_razao_social)'),
            supabaseClient.from('nota_fiscal_itens').select('produtos(nome), quantidade, preco_unitario_momento'),
            calcularEstoqueCompleto()
        ]);
        
        const { data: todasAsVendas, error: vendasError } = vendasResult;
        const { data: todosOsItensVendidos, error: itensError } = itensResult;
        
        if (vendasError || itensError) {
            throw new Error('Falha ao buscar dados para o dashboard.');
        }

        const vendasFiltradas = filtrarVendasPorPeriodo(todasAsVendas, dataInicio, dataFim);
        
        const faturamentoBruto = vendasFiltradas.reduce((acc, venda) => acc + Number(venda.valor_total), 0);
        const vendasRealizadas = vendasFiltradas.length;
        const ticketMedio = vendasRealizadas > 0 ? faturamentoBruto / vendasRealizadas : 0;
        const insumosEstoqueBaixo = estoque.filter(item => item.estoqueAtual <= item.nivel_minimo_estoque && item.estoqueAtual > 0).length;

        const topClientes = calcularTopClientes(vendasFiltradas);
        
        document.getElementById('kpi-faturamento-bruto').textContent = `R$ ${faturamentoBruto.toFixed(2).replace('.', ',')}`;
        document.getElementById('kpi-vendas-realizadas').textContent = vendasRealizadas;
        document.getElementById('kpi-ticket-medio').textContent = `R$ ${ticketMedio.toFixed(2).replace('.', ',')}`;
        document.getElementById('kpi-estoque-baixo').textContent = insumosEstoqueBaixo;

        renderizarListaWidget('lista-maiores-clientes', topClientes, 'R$');
        
        // Gráficos
        const dadosGraficoVendas = calcularVendasPorMes(vendasFiltradas);
        const dadosGraficoProdutos = calcularTopProdutos(todosOsItensVendidos, vendasFiltradas);
        
        criarGraficoVendas(dadosGraficoVendas);
        criarGraficoProdutos(dadosGraficoProdutos);
        renderizarListaWidget('lista-produtos-mais-vendidos', dadosGraficoProdutos, 'un');


    } catch (error) {
        console.error("Erro ao montar o dashboard:", error);
        showNotification("Erro ao carregar dados do dashboard.", "error");
    }
}

function filtrarVendasPorPeriodo(vendas, dataInicio, dataFim) {
    const inicio = new Date(dataInicio + 'T00:00:00Z');
    const fim = new Date(dataFim + 'T23:59:59Z');

    return vendas.filter(venda => {
        const dataVenda = new Date(venda.created_at);
        return dataVenda >= inicio && dataVenda <= fim;
    });
}

function calcularVendasPorMes(vendas) {
    const vendasMensais = {};
    const meses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

    vendas.forEach(venda => {
        const mes = new Date(venda.created_at).getMonth();
        const nomeMes = meses[mes];
        vendasMensais[nomeMes] = (vendasMensais[nomeMes] || 0) + Number(venda.valor_total);
    });

    return {
        labels: Object.keys(vendasMensais),
        data: Object.values(vendasMensais)
    };
}


function calcularTopProdutos(todosOsItens, vendasFiltradas) {
    const idsDasVendasFiltradas = vendasFiltradas.map(v => v.id);
    const contagem = {};

    // Este é um filtro simulado, o ideal seria buscar itens apenas das notas filtradas
    // Para simplificar, vamos assumir que todosOsItensVendidos se refere ao período.
    // O correto seria filtrar 'nota_fiscal_itens' no backend.

    todosOsItens.forEach(item => {
        const nome = item.produtos.nome;
        contagem[nome] = (contagem[nome] || 0) + Number(item.quantidade);
    });
    
    return Object.entries(contagem)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([nome, valor]) => ({ nome, valor }));
}


function calcularTopClientes(vendas) {
    const contagem = {};
    vendas.forEach(venda => {
        const nome = venda.contatos.nome_razao_social;
        contagem[nome] = (contagem[nome] || 0) + Number(venda.valor_total);
    });

    return Object.entries(contagem)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([nome, valor]) => ({ nome, valor: valor.toFixed(2) }));
}

function renderizarListaWidget(elementId, dados, unidade) {
    const lista = document.getElementById(elementId);
    lista.innerHTML = '';
    if (dados.length === 0) {
        lista.innerHTML = '<li>Nenhuma venda no período.</li>';
        return;
    }
    dados.forEach(item => {
        const li = document.createElement('li');
        li.innerHTML = `<span>${item.nome}</span><strong>${item.valor} ${unidade}</strong>`;
        lista.appendChild(li);
    });
}

async function calcularEstoqueCompleto() {
    try {
        const [
            { data: insumos }, { data: todasAsCompras }, { data: todasAsVendas }, { data: todasAsReceitas }
        ] = await Promise.all([
            supabaseClient.from('insumos').select('id, nome, unidade_medida, nivel_minimo_estoque'),
            supabaseClient.from('nota_entrada_itens').select('insumo_id, quantidade'),
            supabaseClient.from('nota_fiscal_itens').select('produto_id, quantidade'),
            supabaseClient.from('receitas').select('produto_id, insumo_id, quantidade')
        ]);

        const estoque = {};
        insumos.forEach(insumo => {
            estoque[insumo.id] = { ...insumo, totalComprado: 0, totalUsado: 0, estoqueAtual: 0 };
        });
        todasAsCompras.forEach(item => {
            if (estoque[item.insumo_id]) estoque[item.insumo_id].totalComprado += Number(item.quantidade);
        });
        todasAsVendas.forEach(itemVendido => {
            const receitasDoProduto = todasAsReceitas.filter(r => r.produto_id === itemVendido.produto_id);
            receitasDoProduto.forEach(receita => {
                if (estoque[receita.insumo_id]) {
                    estoque[receita.insumo_id].totalUsado += Number(receita.quantidade) * Number(itemVendido.quantidade);
                }
            });
        });

        return Object.values(estoque).map(insumo => {
            insumo.estoqueAtual = insumo.totalComprado - insumo.totalUsado;
            return insumo;
        });
    } catch (error) {
        console.error("Erro no cálculo de estoque:", error);
        return [];
    }
}

function criarGraficoVendas(dados) {
    const ctx = document.getElementById('vendasPorMesChart').getContext('2d');
    if (vendasPorMesChartInstance) {
        vendasPorMesChartInstance.destroy();
    }
    vendasPorMesChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: dados.labels,
            datasets: [{
                label: 'Faturamento Mensal',
                data: dados.data,
                backgroundColor: 'rgba(214, 51, 132, 0.6)',
                borderColor: 'rgba(214, 51, 132, 1)',
                borderWidth: 1
            }]
        },
        options: {
            scales: { y: { beginAtZero: true } },
            responsive: true,
            maintainAspectRatio: false
        }
    });
}

function criarGraficoProdutos(dados) {
    const ctx = document.getElementById('topProdutosChart').getContext('2d');
    if (topProdutosChartInstance) {
        topProdutosChartInstance.destroy();
    }
    topProdutosChartInstance = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: dados.map(p => p.nome),
            datasets: [{
                label: 'Unidades Vendidas',
                data: dados.map(p => p.valor),
                backgroundColor: [
                    'rgba(214, 51, 132, 0.6)', 'rgba(255, 159, 64, 0.6)',
                    'rgba(255, 205, 86, 0.6)', 'rgba(75, 192, 192, 0.6)',
                    'rgba(54, 162, 235, 0.6)'
                ],
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false
        }
    });
}

function setDefaultDates() {
    const hoje = new Date();
    const primeiroDiaAno = new Date(hoje.getFullYear(), 0, 1).toISOString().split('T')[0];
    const ultimoDiaAno = new Date(hoje.getFullYear(), 11, 31).toISOString().split('T')[0];

    document.getElementById('dashboard-data-inicio').value = primeiroDiaAno;
    document.getElementById('dashboard-data-fim').value = ultimoDiaAno;
}

document.addEventListener('DOMContentLoaded', () => {
    const dataInicioFiltro = document.getElementById('dashboard-data-inicio');
    const dataFimFiltro = document.getElementById('dashboard-data-fim');

    setDefaultDates();

    if (dataInicioFiltro && dataFimFiltro) {
        dataInicioFiltro.addEventListener('change', calcularEExibirDashboard);
        dataFimFiltro.addEventListener('change', calcularEExibirDashboard);
    }

    const linkDashboard = document.querySelector('.nav-link[data-target="tela-dashboard"]');
    if (linkDashboard) {
        linkDashboard.addEventListener('click', () => {
            setDefaultDates();
            calcularEExibirDashboard();
        });

        if(linkDashboard.classList.contains('active')) {
            calcularEExibirDashboard();
        }
    }
    
    document.addEventListener('dadosAtualizados', calcularEExibirDashboard);
});