// ---===[ 1. CONFIGURAÇÃO DO SUPABASE ]===---
const SUPABASE_URL = 'https://bujffxasexuglgmtloxv.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ1amZmeGFzZXh1Z2xnbXRsb3h2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU1NTY1NDAsImV4cCI6MjA3MTEzMjU0MH0.OmbttnQ6ThFCYuspr3IL2b25RULx_ZqoXUfcoN7KF_M';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ---===[ 2. FUNÇÕES GLOBAIS DE AÇÃO (CHAMADAS PELO ONCLICK) ]===---
function editarInsumo(id, nome, unidade, preco) {
    const modal = document.getElementById('modal-editar-insumo');
    document.getElementById('edit-insumo-id').value = id;
    document.getElementById('edit-nome-insumo').value = nome;
    document.getElementById('edit-unidade-medida').value = unidade;
    document.getElementById('edit-preco-unitario').value = preco;
    modal.style.display = 'block';
}

async function deletarInsumo(id, nome) {
    if (!confirm(`TEM CERTEZA QUE QUER DELETAR O INSUMO "${nome}"?`)) return;
    const { error } = await supabaseClient.from('insumos').delete().match({ id: id });
    if (error) {
        if (error.code === '23503') {
            alert(`ERRO: "${nome}" não pode ser deletado pois está em uso em alguma receita.`);
        } else {
            alert(`Não foi possível deletar o insumo "${nome}".`);
        }
    } else {
        alert(`Insumo "${nome}" deletado com sucesso!`);
        document.dispatchEvent(new CustomEvent('dadosAtualizados'));
    }
}

async function gerenciarProduto(produtoId) {
    const modal = document.getElementById('modal-gerenciar-produto');
    const { data: produto, error } = await supabaseClient.from('produtos').select('*').eq('id', produtoId).single();
    if (error) { return alert('Erro ao carregar dados do produto.'); }
    
    document.getElementById('nome-produto-modal').textContent = produto.nome;
    document.getElementById('gerenciar-produto-id').value = produto.id;
    document.getElementById('preco-final-definido').value = produto.preco_venda ? Number(produto.preco_venda).toFixed(2) : '';
    
    document.getElementById('lista-custos-adicionais').innerHTML = '';
    adicionarCampoDeCusto('Embalagem', 2.50);
    adicionarCampoDeCusto('Mão de Obra', 5.00);

    await carregarIngredientesNoModal(produtoId);
    modal.style.display = 'block';
}

async function deletarProduto(id, nome) {
    if (!confirm(`DELETAR PRODUTO "${nome}"?\n\nATENÇÃO: Todas as receitas e vendas associadas a ele também serão apagadas!`)) return;
    await supabaseClient.from('receitas').delete().match({ produto_id: id });
    await supabaseClient.from('vendas').delete().match({ produto_id: id });
    const { error } = await supabaseClient.from('produtos').delete().match({ id: id });
    if (error) { alert(`Erro ao deletar o produto "${nome}".`); } 
    else { alert(`Produto "${nome}" deletado com sucesso!`); document.dispatchEvent(new CustomEvent('dadosAtualizados')); }
}

async function removerIngrediente(receitaItemId) {
    const { error } = await supabaseClient.from('receitas').delete().match({ id: receitaItemId });
    if (error) { alert('Erro ao remover ingrediente.'); }
    else { 
        const produtoId = document.getElementById('gerenciar-produto-id').value;
        carregarIngredientesNoModal(produtoId);
    }
}

async function carregarIngredientesNoModal(produtoId) {
    const { data, error } = await supabaseClient.from('receitas').select(`id, quantidade, insumos (nome, unidade_medida, preco_unitario)`).eq('produto_id', produtoId);
    const listaIngredientesModal = document.getElementById('lista-ingredientes-modal');
    if (error) { return; }
    window.ingredientesAtuais = data || [];
    listaIngredientesModal.innerHTML = '';
    if (window.ingredientesAtuais.length === 0) {
        listaIngredientesModal.innerHTML = '<li>Nenhum ingrediente adicionado.</li>';
    } else {
        window.ingredientesAtuais.forEach(item => {
            const li = document.createElement('li');
            li.innerHTML = `${item.quantidade} ${item.insumos.unidade_medida} de ${item.insumos.nome} <button class="btn-remover-ingrediente" onclick="removerIngrediente(${item.id})">❌</button>`;
            listaIngredientesModal.appendChild(li);
        });
    }
    recalcularAnaliseDeCustos();
}

function adicionarCampoDeCusto(nome = '', valor = 0) {
    const listaCustosAdicionais = document.getElementById('lista-custos-adicionais');
    const div = document.createElement('div');
    div.className = 'custo-adicional-item';
    div.innerHTML = `
        <input type="text" value="${nome}" class="custo-nome" placeholder="Nome do Custo (ex: Gás)">
        <input type="number" value="${valor.toFixed(2)}" class="custo-valor" step="0.01">
        <button type="button" class="btn-remover-custo" onclick="this.parentElement.remove(); recalcularAnaliseDeCustos();">❌</button>
    `;
    listaCustosAdicionais.appendChild(div);
    div.querySelectorAll('input').forEach(input => input.addEventListener('input', recalcularAnaliseDeCustos));
};

function recalcularAnaliseDeCustos() {
    let custoIngredientes = (window.ingredientesAtuais || []).reduce((acc, item) => acc + (item.quantidade * (item.insumos.preco_unitario || 0)), 0);
    let outrosCustos = 0;
    document.querySelectorAll('.custo-adicional-item .custo-valor').forEach(input => {
        outrosCustos += parseFloat(input.value) || 0;
    });
    
    const custoTotal = custoIngredientes + outrosCustos;
    const margem = parseFloat(document.getElementById('margem-lucro').value) || 0;
    const lucro = custoTotal * (margem / 100);
    const precoSugerido = custoTotal + lucro;

    document.getElementById('custo-ingredientes-valor').textContent = `R$ ${custoIngredientes.toFixed(2)}`;
    document.getElementById('custo-total-valor').textContent = `R$ ${custoTotal.toFixed(2)}`;
    document.getElementById('preco-sugerido-valor').textContent = `R$ ${precoSugerido.toFixed(2)}`;
}

// ---===[ 3. CÓDIGO PRINCIPAL DA APLICAÇÃO ]===---
document.addEventListener('DOMContentLoaded', () => {
    
    // --- LÓGICA DE NAVEGAÇÃO E MODAIS ---
    const navButtons = document.querySelectorAll('nav button');
    const telas = document.querySelectorAll('main .tela');
    const modals = document.querySelectorAll('.modal');

    function mostrarTela(targetId) {
        telas.forEach(tela => tela.classList.add('hidden'));
        const telaAlvo = document.getElementById(targetId);
        if (telaAlvo) telaAlvo.classList.remove('hidden');
    }

    navButtons.forEach(button => button.addEventListener('click', () => mostrarTela(button.getAttribute('data-target'))));
    
    modals.forEach(modal => {
        modal.querySelector('.close-button').onclick = () => modal.style.display = 'none';
    });
    window.onclick = (event) => {
        if (event.target.classList.contains('modal')) {
            event.target.style.display = 'none';
        }
    };

    // --- TELA DE INSUMOS ---
    const formInsumos = document.getElementById('form-insumos');
    const formEditarInsumo = document.getElementById('form-editar-insumo');
    let insumosData = [];

    function renderizarTabelaInsumos() {
        const corpoTabela = document.getElementById('corpo-tabela-insumos');
        corpoTabela.innerHTML = '';
        if (insumosData.length === 0) {
            corpoTabela.innerHTML = '<tr><td colspan="4">Nenhum insumo cadastrado.</td></tr>';
            return;
        }
        insumosData.forEach(insumo => {
            const tr = document.createElement('tr');
            const preco = insumo.preco_unitario ? Number(insumo.preco_unitario).toFixed(2) : '0.00';
            tr.innerHTML = `
                <td>${insumo.nome}</td>
                <td>${insumo.unidade_medida}</td>
                <td>R$ ${preco}</td>
                <td class="actions-container">
                    <button class="btn-acao btn-warning" onclick="editarInsumo(${insumo.id}, '${insumo.nome}', '${insumo.unidade_medida}', ${insumo.preco_unitario || 0})">✏️</button>
                    <button class="btn-acao btn-danger" onclick="deletarInsumo(${insumo.id}, '${insumo.nome}')">🗑️</button>
                </td>
            `;
            corpoTabela.appendChild(tr);
        });
    }

    formInsumos.addEventListener('submit', async (event) => {
        event.preventDefault();
        const { error } = await supabaseClient.from('insumos').insert([{ 
            nome: document.getElementById('nome-insumo').value, 
            unidade_medida: document.getElementById('unidade-medida').value, 
            preco_unitario: document.getElementById('preco-unitario').value 
        }]);
        if (error) { alert('Ocorreu um erro ao salvar.'); } 
        else { alert('Insumo salvo!'); formInsumos.reset(); document.dispatchEvent(new CustomEvent('dadosAtualizados')); }
    });
    
    formEditarInsumo.addEventListener('submit', async (event) => {
        event.preventDefault();
        const id = document.getElementById('edit-insumo-id').value;
        const { error } = await supabaseClient.from('insumos').update({ 
            nome: document.getElementById('edit-nome-insumo').value, 
            unidade_medida: document.getElementById('edit-unidade-medida').value, 
            preco_unitario: document.getElementById('edit-preco-unitario').value 
        }).match({ id });
        if (error) { alert('Não foi possível salvar as alterações.'); } 
        else { alert('Insumo atualizado!'); document.getElementById('modal-editar-insumo').style.display = 'none'; document.dispatchEvent(new CustomEvent('dadosAtualizados')); }
    });

    // --- TELA DE PRODUTOS ---
    const formProdutos = document.getElementById('form-produtos');
    let produtosData = [];

    function renderizarTabelaProdutos() {
        const corpoTabela = document.getElementById('corpo-tabela-produtos');
        corpoTabela.innerHTML = '';
        if (produtosData.length === 0) {
            corpoTabela.innerHTML = '<tr><td colspan="3">Nenhum produto cadastrado.</td></tr>';
            return;
        }
        produtosData.forEach(produto => {
            const tr = document.createElement('tr');
            const precoVenda = produto.preco_venda ? `R$ ${Number(produto.preco_venda).toFixed(2)}` : '<span style="color: #aaa;">Não precificado</span>';
            tr.innerHTML = `
                <td>${produto.nome}</td>
                <td><strong>${precoVenda}</strong></td>
                <td class="actions-container">
                    <button class="btn-acao btn-info" onclick="gerenciarProduto(${produto.id})">⚙️ Gerenciar</button>
                    <button class="btn-acao btn-danger" onclick="deletarProduto(${produto.id}, '${produto.nome}')">🗑️</button>
                </td>
            `;
            corpoTabela.appendChild(tr);
        });
    }
    
    formProdutos.addEventListener('submit', async (event) => {
        event.preventDefault();
        const { error } = await supabaseClient.from('produtos').insert([{ nome: document.getElementById('nome-produto').value }]);
        if (error) { alert('Erro ao salvar produto.'); } 
        else { alert('Produto salvo!'); formProdutos.reset(); document.dispatchEvent(new CustomEvent('dadosAtualizados')); }
    });

    // --- MODAL GERENCIAR PRODUTO ---
    const formAdicionarIngrediente = document.getElementById('form-adicionar-ingrediente');
    
    formAdicionarIngrediente.addEventListener('submit', async (event) => {
        event.preventDefault();
        const produtoId = document.getElementById('gerenciar-produto-id').value;
        const { error } = await supabaseClient.from('receitas').insert([{ 
            produto_id: produtoId, 
            insumo_id: document.getElementById('select-insumo-receita').value, 
            quantidade: document.getElementById('quantidade-ingrediente').value 
        }]);
        if (error) { alert('Erro ao adicionar ingrediente.'); } 
        else { formAdicionarIngrediente.reset(); carregarIngredientesNoModal(produtoId); }
    });
    
    document.getElementById('btn-adicionar-custo').onclick = () => adicionarCampoDeCusto();
    document.getElementById('margem-lucro').addEventListener('input', recalcularAnaliseDeCustos);

    document.getElementById('btn-salvar-preco-venda').addEventListener('click', async () => {
        const produtoId = document.getElementById('gerenciar-produto-id').value;
        const precoFinal = document.getElementById('preco-final-definido').value;
        if (!precoFinal || precoFinal <= 0) { return alert('Defina um preço de venda válido.'); }
        const { error } = await supabaseClient.from('produtos').update({ preco_venda: precoFinal }).match({ id: produtoId });
        if (error) { alert('Erro ao salvar o preço.'); } 
        else { 
            alert('Preço de venda salvo com sucesso!');
            document.getElementById('modal-gerenciar-produto').style.display = 'none';
            document.dispatchEvent(new CustomEvent('dadosAtualizados'));
        }
    });

    // --- TELA DE VENDAS ---
    const formVendas = document.getElementById('form-vendas');
    
    async function carregarVendas() {
        const { data: vendas, error } = await supabaseClient.from('vendas').select(`*, produtos (nome)`).order('created_at', { ascending: false }).limit(10);
        const listaVendas = document.getElementById('lista-vendas');
        listaVendas.innerHTML = '';
        if (vendas && vendas.length > 0) {
            vendas.forEach(venda => {
                const item = document.createElement('li');
                item.textContent = `[${new Date(venda.created_at).toLocaleDateString('pt-BR')}] - ${venda.quantidade_vendida}x ${venda.produtos?.nome || 'Produto apagado'} - Total: R$ ${Number(venda.valor_total).toFixed(2)}`;
                listaVendas.appendChild(item);
            });
        } else {
            listaVendas.innerHTML = '<li>Nenhuma venda registrada.</li>';
        }
    }

    formVendas.addEventListener('submit', async (event) => {
        event.preventDefault();
        const { error } = await supabaseClient.from('vendas').insert([{ 
            produto_id: document.getElementById('select-produto-venda').value, 
            quantidade_vendida: document.getElementById('quantidade-vendida').value, 
            valor_total: document.getElementById('valor-total-venda').value 
        }]);
        if (error) { alert('Erro ao registrar venda.'); } 
        else { alert('Venda registrada!'); formVendas.reset(); carregarVendas(); }
    });
    
    // ---===[ 4. INICIALIZAÇÃO E EVENTOS GLOBAIS ]===---
    async function atualizarTodosOsDados() {
        const [insumosResult, produtosResult] = await Promise.all([
            supabaseClient.from('insumos').select('*').order('nome'),
            supabaseClient.from('produtos').select('*').order('nome')
        ]);
        
        insumosData = insumosResult.data || [];
        produtosData = produtosResult.data || [];
        
        renderizarTabelaInsumos();
        renderizarTabelaProdutos();
        
        const selectInsumo = document.getElementById('select-insumo-receita');
        const selectProdutoVenda = document.getElementById('select-produto-venda');
        selectInsumo.innerHTML = '<option value="">Selecione...</option>';
        selectProdutoVenda.innerHTML = '<option value="">Selecione...</option>';
        
        insumosData.forEach(i => selectInsumo.innerHTML += `<option value="${i.id}">${i.nome}</option>`);
        produtosData.forEach(p => selectProdutoVenda.innerHTML += `<option value="${p.id}">${p.nome}</option>`);
        
        await carregarVendas();
    }
    
    document.addEventListener('dadosAtualizados', atualizarTodosOsDados);
    
    mostrarTela('tela-insumos');
    atualizarTodosOsDados();
});
