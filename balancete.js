// Este arquivo (balancete.js) será responsável por calcular e exibir o balancete financeiro.

async function calcularEExibirBalancete() {
    const dataInicio = document.getElementById('balancete-data-inicio').value;
    const dataFim = document.getElementById('balancete-data-fim').value;

    if (!dataInicio || !dataFim) {
        return; // Não executa se as datas não estiverem setadas
    }

    try {
        const [
            { data: todasAsVendas, error: vendasError },
            { data: todasAsCompras, error: comprasError }
        ] = await Promise.all([
            supabaseClient.from('notas_fiscais').select('created_at, valor_total, contatos(nome_razao_social)'),
            supabaseClient.from('notas_entrada').select('data_compra, valor_total, contatos(nome_razao_social)')
        ]);

        if (vendasError || comprasError) {
            throw new Error('Falha ao buscar dados para o balancete.');
        }

        // 1. Filtrar Vendas e Compras pelo Período
        const vendasFiltradas = filtrarVendasPorPeriodoBalancete(todasAsVendas, dataInicio, dataFim);
        const comprasFiltradas = filtrarComprasPorPeriodo(todasAsCompras, dataInicio, dataFim);

        // 2. Calcular Totais
        const totalReceitas = vendasFiltradas.reduce((acc, venda) => acc + Number(venda.valor_total), 0);
        const totalCustos = comprasFiltradas.reduce((acc, compra) => acc + Number(compra.valor_total), 0);
        const lucroBruto = totalReceitas - totalCustos;
        const margemLucro = totalReceitas > 0 ? (lucroBruto / totalReceitas) * 100 : 0;

        // 3. Exibir KPIs
        document.getElementById('balancete-receitas').textContent = `R$ ${totalReceitas.toFixed(2).replace('.', ',')}`;
        document.getElementById('balancete-custos').textContent = `R$ ${totalCustos.toFixed(2).replace('.', ',')}`;
        document.getElementById('balancete-lucro').textContent = `R$ ${lucroBruto.toFixed(2).replace('.', ',')}`;
        document.getElementById('balancete-margem').textContent = `${margemLucro.toFixed(2).replace('.', ',')}%`;
        
        const cardLucro = document.getElementById('card-lucro-bruto');
        if (lucroBruto < 0) {
            cardLucro.classList.add('prejuizo');
        } else {
            cardLucro.classList.remove('prejuizo');
        }

        // 4. Renderizar Tabelas de Detalhes
        renderizarTabelaDetalhes('balancete-tabela-receitas', vendasFiltradas, 'venda');
        renderizarTabelaDetalhes('balancete-tabela-custos', comprasFiltradas, 'compra');


    } catch (error) {
        console.error("Erro ao montar o balancete:", error);
        showNotification("Erro ao carregar dados do balancete.", "error");
    }
}

function filtrarVendasPorPeriodoBalancete(vendas, dataInicio, dataFim) {
    const inicio = new Date(dataInicio + 'T00:00:00Z');
    const fim = new Date(dataFim + 'T23:59:59Z');

    return vendas.filter(venda => {
        const dataVenda = new Date(venda.created_at);
        return dataVenda >= inicio && dataVenda <= fim;
    });
}

function filtrarComprasPorPeriodo(compras, dataInicio, dataFim) {
    const inicio = new Date(dataInicio);
    const fim = new Date(dataFim);

    return compras.filter(compra => {
        const dataCompra = new Date(compra.data_compra);
        return dataCompra >= inicio && dataCompra <= fim;
    });
}

function renderizarTabelaDetalhes(elementId, dados, tipo) {
    const corpoTabela = document.getElementById(elementId);
    corpoTabela.innerHTML = '';

    if (dados.length === 0) {
        corpoTabela.innerHTML = '<tr><td colspan="3">Nenhum lançamento no período.</td></tr>';
        return;
    }

    dados.forEach(item => {
        const tr = document.createElement('tr');
        const data = tipo === 'venda' ? new Date(item.created_at) : new Date(item.data_compra);
        const nome = item.contatos ? item.contatos.nome_razao_social : (tipo === 'venda' ? 'Cliente Removido' : 'Fornecedor Removido');
        
        tr.innerHTML = `
            <td>${data.toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</td>
            <td>${nome}</td>
            <td>R$ ${Number(item.valor_total).toFixed(2)}</td>
        `;
        corpoTabela.appendChild(tr);
    });
}


function setDefaultDatesBalancete() {
    const hoje = new Date();
    const primeiroDiaAno = new Date(hoje.getFullYear(), 0, 1).toISOString().split('T')[0];
    const ultimoDiaAno = new Date(hoje.getFullYear(), 11, 31).toISOString().split('T')[0];

    document.getElementById('balancete-data-inicio').value = primeiroDiaAno;
    document.getElementById('balancete-data-fim').value = ultimoDiaAno;
}

document.addEventListener('DOMContentLoaded', () => {
    const dataInicioFiltro = document.getElementById('balancete-data-inicio');
    const dataFimFiltro = document.getElementById('balancete-data-fim');

    if (dataInicioFiltro && dataFimFiltro) {
        dataInicioFiltro.addEventListener('change', calcularEExibirBalancete);
        dataFimFiltro.addEventListener('change', calcularEExibirBalancete);
    }

    const linkBalancete = document.querySelector('.nav-link[data-target="tela-balancete"]');
    if (linkBalancete) {
        linkBalancete.addEventListener('click', () => {
            setDefaultDatesBalancete();
            calcularEExibirBalancete();
        });
    }
    
    document.addEventListener('dadosAtualizados', calcularEExibirBalancete);
});