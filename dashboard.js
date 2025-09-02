// Este arquivo (dashboard.js) será responsável por calcular e exibir os KPIs.

async function calcularEExibirDashboard() {
    const periodo = document.getElementById('dashboard-periodo').value;

    try {
        const [
            vendasResult,
            itensResult,
            estoqueResult 
        ] = await Promise.all([
            supabaseClient.from('notas_fiscais').select('id, created_at, valor_total, contatos(nome_razao_social)'),
            supabaseClient.from('nota_fiscal_itens').select('produtos(nome), quantidade'),
            calcularEstoqueCompleto() 
        ]);

        const { data: todasAsVendas, error: vendasError } = vendasResult;
        const { data: todosOsItensVendidos, error: itensError } = itensResult;
        const estoque = estoqueResult; // Erro estava aqui, agora corrigido

        if (vendasError || itensError) {
            throw new Error('Falha ao buscar dados para o dashboard.');
        }

        const vendasFiltradas = filtrarVendasPorPeriodo(todasAsVendas, periodo);

        const faturamentoBruto = vendasFiltradas.reduce((acc, venda) => acc + Number(venda.valor_total), 0);
        const vendasRealizadas = vendasFiltradas.length;
        const ticketMedio = vendasRealizadas > 0 ? faturamentoBruto / vendasRealizadas : 0;
        const insumosEstoqueBaixo = estoque.filter(item => item.estoqueAtual <= item.nivel_minimo_estoque && item.estoqueAtual > 0).length;

        const topProdutos = calcularTopProdutos(todosOsItensVendidos);
        const topClientes = calcularTopClientes(vendasFiltradas);

        document.getElementById('kpi-faturamento-bruto').textContent = `R$ ${faturamentoBruto.toFixed(2).replace('.', ',')}`;
        document.getElementById('kpi-vendas-realizadas').textContent = vendasRealizadas;
        document.getElementById('kpi-ticket-medio').textContent = `R$ ${ticketMedio.toFixed(2).replace('.', ',')}`;
        document.getElementById('kpi-estoque-baixo').textContent = insumosEstoqueBaixo;

        renderizarListaWidget('lista-produtos-mais-vendidos', topProdutos, 'un');
        renderizarListaWidget('lista-maiores-clientes', topClientes, 'R$');

    } catch (error) {
        console.error("Erro ao montar o dashboard:", error);
        showNotification("Erro ao carregar dados do dashboard.", "error");
    }
}

function filtrarVendasPorPeriodo(vendas, periodo) {
    const agora = new Date();
    let dataInicio;

    switch (periodo) {
        case 'hoje':
            dataInicio = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
            break;
        case 'semana':
            dataInicio = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() - agora.getDay());
            break;
        case 'mes':
            dataInicio = new Date(agora.getFullYear(), agora.getMonth(), 1);
            break;
        case 'ano':
            dataInicio = new Date(agora.getFullYear(), 0, 1);
            break;
        default:
            dataInicio = new Date(agora.getFullYear(), agora.getMonth(), 1);
    }

    return vendas.filter(venda => new Date(venda.created_at) >= dataInicio);
}

function calcularTopProdutos(itensVendidos) {
    const contagem = {};
    itensVendidos.forEach(item => {
        const nome = item.produtos.nome;
        contagem[nome] = (contagem[nome] || 0) + Number(item.quantidade);
    });

    return Object.entries(contagem)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5) // Pega os 5 primeiros
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
        .slice(0, 5) // Pega os 5 primeiros
        .map(([nome, valor]) => ({ nome, valor: valor.toFixed(2) }));
}

function renderizarListaWidget(elementId, dados, unidade) {
    const lista = document.getElementById(elementId);
    lista.innerHTML = '';
    if (dados.length === 0) {
        lista.innerHTML = '<li>Nenhum dado no período.</li>';
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
            { data: insumos, error: insumosError },
            { data: todasAsCompras, error: comprasError },
            { data: todasAsVendas, error: vendasError },
            { data: todasAsReceitas, error: receitasError }
        ] = await Promise.all([
            supabaseClient.from('insumos').select('id, nome, unidade_medida, nivel_minimo_estoque'),
            supabaseClient.from('nota_entrada_itens').select('insumo_id, quantidade'),
            supabaseClient.from('nota_fiscal_itens').select('produto_id, quantidade'),
            supabaseClient.from('receitas').select('produto_id, insumo_id, quantidade')
        ]);

        if (insumosError || comprasError || vendasError || receitasError) throw new Error('Falha ao buscar dados para o estoque.');

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
        console.error("Erro no cálculo de estoque para o dashboard:", error);
        return []; // Retorna array vazio em caso de erro para não quebrar o dashboard
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const filtroPeriodo = document.getElementById('dashboard-periodo');
    if (filtroPeriodo) {
        filtroPeriodo.addEventListener('change', calcularEExibirDashboard);
    }

    const linkDashboard = document.querySelector('.nav-link[data-target="tela-dashboard"]');
    if (linkDashboard) {
        linkDashboard.addEventListener('click', calcularEExibirDashboard);
        // Calcula uma vez ao carregar a página se o dashboard for a tela inicial
        if(linkDashboard.classList.contains('active')) {
            calcularEExibirDashboard();
        }
    }
    
    document.addEventListener('dadosAtualizados', calcularEExibirDashboard);
});