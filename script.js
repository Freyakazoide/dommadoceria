const SUPABASE_URL = 'https://bujffxasexuglgmtloxv.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ1amZmeGFzZXh1Z2xnbXRsb3h2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU1NTY1NDAsImV4cCI6MjA3MTEzMjU0MH0.OmbttnQ6ThFCYuspr3IL2b25RULx_ZqoXUfcoN7KF_M';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

function showNotification(message, type = 'success') {
    const container = document.getElementById('notification-container');
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    container.appendChild(notification);
    setTimeout(() => {
        notification.remove();
    }, 10000);
}

function parsePapeis(papeis) {
    if (typeof papeis === 'string') {
        try {
            return JSON.parse(papeis);
        } catch (e) {
            return [];
        }
    }
    return Array.isArray(papeis) ? papeis : [];
}

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
            showNotification(`ERRO: "${nome}" não pode ser deletado pois está em uso em alguma receita.`, 'error');
        } else {
            showNotification(`Não foi possível deletar o insumo "${nome}".`, 'error');
        }
    } else {
        showNotification(`Insumo "${nome}" deletado com sucesso!`);
        document.dispatchEvent(new CustomEvent('dadosAtualizados'));
    }
}

async function gerenciarProduto(produtoId) {
    const modal = document.getElementById('modal-gerenciar-produto');
    const { data: produto, error } = await supabaseClient.from('produtos').select('*').eq('id', produtoId).single();
    if (error) { return showNotification('Erro ao carregar dados do produto.', 'error'); }
    
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
    if (!confirm(`DELETAR PRODUTO "${nome}"?\n\nATENÇÃO: Todas as receitas e notas fiscais associadas a ele também serão apagadas!`)) return;
    
    await supabaseClient.from('nota_fiscal_itens').delete().match({ produto_id: id });
    await supabaseClient.from('receitas').delete().match({ produto_id: id });
    const { error } = await supabaseClient.from('produtos').delete().match({ id: id });

    if (error) { 
        showNotification(`Erro ao deletar o produto "${nome}".`, 'error'); 
        console.error('Erro ao deletar produto:', error);
    } 
    else { 
        showNotification(`Produto "${nome}" deletado com sucesso!`); 
        document.dispatchEvent(new CustomEvent('dadosAtualizados')); 
    }
}

async function removerIngrediente(receitaItemId) {
    const { error } = await supabaseClient.from('receitas').delete().match({ id: receitaItemId });
    if (error) { showNotification('Erro ao remover ingrediente.', 'error'); }
    else { 
        const produtoId = document.getElementById('gerenciar-produto-id').value;
        carregarIngredientesNoModal(produtoId);
    }
}

async function editarContato(contatoId) {
    const modal = document.getElementById('modal-editar-contato');
    const { data: contato, error } = await supabaseClient.from('contatos').select('*').eq('id', contatoId).single();
    if (error) return showNotification('Erro ao carregar dados do contato.', 'error');

    document.getElementById('edit-contato-id').value = contato.id;
    document.getElementById('edit-contato-nome').value = contato.nome_razao_social;
    document.getElementById('edit-contato-documento').value = contato.cpf_cnpj;
    document.getElementById('edit-contato-telefone').value = contato.telefone;
    document.getElementById('edit-contato-email').value = contato.email;
    document.getElementById('edit-contato-endereco').value = contato.endereco;
    
    const papeis = parsePapeis(contato.papeis);
    document.getElementById('edit-contato-e-cliente').checked = papeis.includes('Cliente');
    document.getElementById('edit-contato-e-fornecedor').checked = papeis.includes('Fornecedor');
    
    document.querySelector(`input[name="edit_tipo_pessoa"][value="${contato.tipo_pessoa}"]`).checked = true;
    atualizarLabelsFormularioContato('edit-');
    modal.style.display = 'block';
}

async function deletarContato(id, nome) {
    if (!confirm(`DELETAR CONTATO "${nome}"?\n\nIsso não poderá ser desfeito.`)) return;
    const { error } = await supabaseClient.from('contatos').delete().match({ id: id });
    if (error) {
        if (error.code === '23503') {
            showNotification(`ERRO: "${nome}" não pode ser deletado pois está associado a notas fiscais.`, 'error');
        } else {
            showNotification(`Erro ao deletar o contato "${nome}".`, 'error');
        }
    } else {
        showNotification(`Contato "${nome}" deletado com sucesso!`);
        document.dispatchEvent(new CustomEvent('dadosAtualizados'));
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

async function verDetalhesNota(notaId) {
    const modal = document.getElementById('modal-ver-nota');
    const container = document.getElementById('detalhes-nota-conteudo');
    container.innerHTML = '<p>Carregando...</p>';
    modal.style.display = 'block';

    const { data: nota, error } = await supabaseClient.from('notas_fiscais').select(`*, contatos(nome_razao_social)`).eq('id', notaId).single();
    if (error) { container.innerHTML = '<p>Erro ao carregar detalhes.</p>'; return; }

    const { data: itens, errorItens } = await supabaseClient.from('nota_fiscal_itens').select(`*, produtos(nome)`).eq('nota_fiscal_id', notaId);
    if (errorItens) { container.innerHTML = '<p>Erro ao carregar itens da nota.</p>'; return; }

    let html = `
        <p><strong>Cliente:</strong> ${nota.contatos.nome_razao_social}</p>
        <p><strong>Data:</strong> ${new Date(nota.created_at).toLocaleDateString('pt-BR')}</p>
        <p><strong>Status:</strong> ${nota.status_pagamento}</p>
        <p><strong>Método:</strong> ${nota.metodo_pagamento}</p>
        <hr>
        <h4>Itens:</h4>
        <ul>
    `;
    if (Array.isArray(itens)) {
        itens.forEach(item => {
            html += `<li>${item.quantidade}x ${item.produtos.nome} - R$ ${Number(item.preco_unitario_momento).toFixed(2)} (un)</li>`;
        });
    }
    html += `</ul><hr><p class="linha-custo total"><strong>TOTAL: R$ ${Number(nota.valor_total).toFixed(2)}</strong></p>`;
    container.innerHTML = html;
}

async function marcarComoPago(notaId) {
    if (!confirm('Deseja marcar esta nota como PAGA?')) return;
    const { error } = await supabaseClient.from('notas_fiscais').update({ status_pagamento: 'Pago' }).match({ id: notaId });
    if (error) { showNotification('Erro ao atualizar status.', 'error'); }
    else { document.dispatchEvent(new CustomEvent('dadosAtualizados', { detail: { highlightedId: notaId } })); }
}

async function deletarNota(notaId) {
    if (!confirm('TEM CERTEZA QUE QUER DELETAR ESTA NOTA FISCAL?\nEsta ação não pode ser desfeita.')) return;
    await supabaseClient.from('nota_fiscal_itens').delete().match({ nota_fiscal_id: notaId });
    const { error } = await supabaseClient.from('notas_fiscais').delete().match({ id: notaId });
    if (error) { showNotification('Erro ao deletar a nota fiscal.', 'error'); }
    else { 
        showNotification('Nota fiscal deletada com sucesso.'); 
        document.dispatchEvent(new CustomEvent('dadosAtualizados'));
    }
}

async function editarNotaSaida(notaId) {
    const modal = document.getElementById('modal-editar-nota-saida');
    document.getElementById('edit-ns-hidden-id').value = notaId;
    document.getElementById('edit-ns-id').textContent = `(#${notaId})`;

    const { data: nota, error } = await supabaseClient.from('notas_fiscais').select(`*, contatos(id)`).eq('id', notaId).single();
    if (error) return showNotification('Erro ao carregar dados da nota.', 'error');

    const { data: itens, errorItens } = await supabaseClient.from('nota_fiscal_itens').select(`*, produtos(*)`).eq('nota_fiscal_id', notaId);
    if (errorItens) return showNotification('Erro ao carregar itens da nota.', 'error');
    
    document.getElementById('edit-ns-cliente').value = nota.contatos.id;
    document.getElementById('edit-ns-metodo-pagamento').value = nota.metodo_pagamento;
    document.getElementById('edit-ns-status-pagamento').value = nota.status_pagamento;
    
    showNotification("Funcionalidade de edição de itens em desenvolvimento.", "info");
    modal.style.display = 'block';
}

function atualizarLabelsFormularioContato(prefixo = '') {
    const radioName = prefixo ? 'edit_tipo_pessoa' : 'tipo_pessoa';
    if (!document.querySelector(`input[name="${radioName}"]`)) return;
    const tipo = document.querySelector(`input[name="${radioName}"]:checked`).value;
    const labelNome = document.getElementById(`${prefixo}label-nome-contato`);
    const labelDocumento = document.getElementById(`${prefixo}label-documento-contato`);
    const inputNome = document.getElementById(`${prefixo}contato-nome`);
    const inputDocumento = document.getElementById(`${prefixo}contato-documento`);

    if (tipo === 'Física') {
        labelNome.textContent = 'Nome Completo';
        inputNome.placeholder = 'Nome do cliente';
        labelDocumento.textContent = 'CPF';
        inputDocumento.placeholder = '___.___.___-__';
    } else {
        labelNome.textContent = 'Razão Social';
        inputNome.placeholder = 'Nome da empresa';
        labelDocumento.textContent = 'CNPJ';
        inputDocumento.placeholder = '__.___.___/____-__';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    
    let insumosData = [];
    let produtosData = [];
    let contatosData = [];
    let notasFiscaisData = [];
    let notasEntradaData = [];
    let nfItens = [];
    let neItens = [];

    let currentPage = 1;
    let rowsPerPage = 20;
    let sortColumn = 'created_at';
    let sortDirection = 'desc';

    const navLinks = document.querySelectorAll('.nav-link');
    const telas = document.querySelectorAll('.main-content .tela');
    const modals = document.querySelectorAll('.modal');
    const formInsumos = document.getElementById('form-insumos');
    const formEditarInsumo = document.getElementById('form-editar-insumo');
    const formProdutos = document.getElementById('form-produtos');
    const formAdicionarIngrediente = document.getElementById('form-adicionar-ingrediente');
    const formContatos = document.getElementById('form-contatos');
    const formEditarContato = document.getElementById('form-editar-contato');
    const formAddNfItem = document.getElementById('form-add-nf-item');
    const formDadosNf = document.getElementById('form-dados-nf');
    const btnSalvarNf = document.getElementById('btn-salvar-nf');
    const formDadosNe = document.getElementById('form-dados-ne');
    const formAddNeItem = document.getElementById('form-add-ne-item');
    const btnSalvarNe = document.getElementById('btn-salvar-ne');

    function mostrarTela(targetId) {
        telas.forEach(tela => tela.classList.add('hidden'));
        const telaAlvo = document.getElementById(targetId);
        if (telaAlvo) telaAlvo.classList.remove('hidden');

        navLinks.forEach(link => {
            link.classList.remove('active');
            if (link.dataset.target === targetId) {
                link.classList.add('active');
            }
        });
    }

    navLinks.forEach(link => {
        link.addEventListener('click', (event) => {
            event.preventDefault();
            mostrarTela(link.dataset.target);
        });
    });
    
    modals.forEach(modal => {
        const closeButton = modal.querySelector('.close-button');
        if (closeButton) {
            closeButton.onclick = () => modal.style.display = 'none';
        }
    });
    window.onclick = (event) => {
        if (event.target.classList.contains('modal')) {
            event.target.style.display = 'none';
        }
    };

    document.querySelectorAll('.sub-nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            const parentNav = e.target.closest('.sub-nav');
            parentNav.querySelectorAll('.sub-nav-link').forEach(l => l.classList.remove('active'));
            e.target.classList.add('active');
            
            const parentTela = e.target.closest('.tela');
            parentTela.querySelectorAll('.subtela').forEach(s => s.classList.add('hidden'));
            document.getElementById(link.dataset.target).classList.remove('hidden');
        });
    });

    function renderizarTabelaInsumos() {
        const corpoTabela = document.getElementById('corpo-tabela-insumos');
        corpoTabela.innerHTML = '';
        if (!insumosData || insumosData.length === 0) {
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
        if (error) { showNotification('Ocorreu um erro ao salvar.', 'error'); } 
        else { showNotification('Insumo salvo!'); formInsumos.reset(); document.dispatchEvent(new CustomEvent('dadosAtualizados')); }
    });
    
    formEditarInsumo.addEventListener('submit', async (event) => {
        event.preventDefault();
        const id = document.getElementById('edit-insumo-id').value;
        const { error } = await supabaseClient.from('insumos').update({ 
            nome: document.getElementById('edit-nome-insumo').value, 
            unidade_medida: document.getElementById('edit-unidade-medida').value, 
            preco_unitario: document.getElementById('edit-preco-unitario').value 
        }).match({ id });
        if (error) { showNotification('Não foi possível salvar as alterações.', 'error'); } 
        else { showNotification('Insumo atualizado!'); document.getElementById('modal-editar-insumo').style.display = 'none'; document.dispatchEvent(new CustomEvent('dadosAtualizados')); }
    });

    function renderizarTabelaProdutos() {
        const corpoTabela = document.getElementById('corpo-tabela-produtos');
        corpoTabela.innerHTML = '';
        if (!produtosData || produtosData.length === 0) {
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
        if (error) { showNotification('Erro ao salvar produto.', 'error'); } 
        else { showNotification('Produto salvo!'); formProdutos.reset(); document.dispatchEvent(new CustomEvent('dadosAtualizados')); }
    });

    formAdicionarIngrediente.addEventListener('submit', async (event) => {
        event.preventDefault();
        const produtoId = document.getElementById('gerenciar-produto-id').value;
        const { error } = await supabaseClient.from('receitas').insert([{ 
            produto_id: produtoId, 
            insumo_id: document.getElementById('select-insumo-receita').value, 
            quantidade: document.getElementById('quantidade-ingrediente').value 
        }]);
        if (error) { showNotification('Erro ao adicionar ingrediente.', 'error'); } 
        else { formAdicionarIngrediente.reset(); carregarIngredientesNoModal(produtoId); }
    });
    
    document.getElementById('btn-adicionar-custo').onclick = () => adicionarCampoDeCusto();
    document.getElementById('margem-lucro').addEventListener('input', recalcularAnaliseDeCustos);

    document.getElementById('btn-salvar-preco-venda').addEventListener('click', async () => {
        const produtoId = document.getElementById('gerenciar-produto-id').value;
        const precoFinal = document.getElementById('preco-final-definido').value;
        if (!precoFinal || precoFinal <= 0) { return showNotification('Defina um preço de venda válido.', 'error'); }
        const { error } = await supabaseClient.from('produtos').update({ preco_venda: precoFinal }).match({ id: produtoId });
        if (error) { showNotification('Erro ao salvar o preço.', 'error'); } 
        else { 
            showNotification('Preço de venda salvo com sucesso!');
            document.getElementById('modal-gerenciar-produto').style.display = 'none';
            document.dispatchEvent(new CustomEvent('dadosAtualizados'));
        }
    });

    function renderizarTabelaContatos() {
        const corpoTabela = document.getElementById('corpo-tabela-contatos');
        corpoTabela.innerHTML = '';
        if (!contatosData || contatosData.length === 0) {
            corpoTabela.innerHTML = '<tr><td colspan="4">Nenhum contato cadastrado.</td></tr>';
            return;
        }
        contatosData.forEach(contato => {
            const tr = document.createElement('tr');
            const papeis = parsePapeis(contato.papeis).join(', ');
            tr.innerHTML = `
                <td>${contato.nome_razao_social}</td>
                <td>${papeis}</td>
                <td>${contato.telefone || 'N/A'}</td>
                <td class="actions-container">
                    <button class="btn-acao btn-warning" onclick="editarContato(${contato.id})">✏️</button>
                    <button class="btn-acao btn-danger" onclick="deletarContato(${contato.id}, '${contato.nome_razao_social}')">🗑️</button>
                </td>
            `;
            corpoTabela.appendChild(tr);
        });
    }

    document.querySelectorAll('input[name="tipo_pessoa"]').forEach(radio => {
        radio.addEventListener('change', () => atualizarLabelsFormularioContato());
    });
    document.querySelectorAll('input[name="edit_tipo_pessoa"]').forEach(radio => {
        radio.addEventListener('change', () => atualizarLabelsFormularioContato('edit-'));
    });

    formContatos.addEventListener('submit', async (event) => {
        event.preventDefault();
        const papeis = [];
        if (document.getElementById('contato-e-cliente').checked) papeis.push('Cliente');
        if (document.getElementById('contato-e-fornecedor').checked) papeis.push('Fornecedor');

        const contato = {
            tipo_pessoa: document.querySelector('input[name="tipo_pessoa"]:checked').value,
            nome_razao_social: document.getElementById('contato-nome').value,
            cpf_cnpj: document.getElementById('contato-documento').value,
            telefone: document.getElementById('contato-telefone').value,
            email: document.getElementById('contato-email').value,
            endereco: document.getElementById('contato-endereco').value,
            papeis: papeis
        };
        const { error } = await supabaseClient.from('contatos').insert([contato]);
        if (error) { showNotification('Erro ao salvar contato.', 'error'); console.error(error); } 
        else { showNotification('Contato salvo com sucesso!'); formContatos.reset(); document.dispatchEvent(new CustomEvent('dadosAtualizados')); }
    });

    formEditarContato.addEventListener('submit', async (event) => {
        event.preventDefault();
        const id = document.getElementById('edit-contato-id').value;
        const papeis = [];
        if (document.getElementById('edit-contato-e-cliente').checked) papeis.push('Cliente');
        if (document.getElementById('edit-contato-e-fornecedor').checked) papeis.push('Fornecedor');

        const contato = {
            tipo_pessoa: document.querySelector('input[name="edit_tipo_pessoa"]:checked').value,
            nome_razao_social: document.getElementById('edit-contato-nome').value,
            cpf_cnpj: document.getElementById('edit-contato-documento').value,
            telefone: document.getElementById('edit-contato-telefone').value,
            email: document.getElementById('edit-contato-email').value,
            endereco: document.getElementById('edit-contato-endereco').value,
            papeis: papeis
        };
        const { error } = await supabaseClient.from('contatos').update(contato).match({ id });
        if (error) { showNotification('Erro ao atualizar contato.', 'error'); } 
        else { showNotification('Contato atualizado com sucesso!'); document.getElementById('modal-editar-contato').style.display = 'none'; document.dispatchEvent(new CustomEvent('dadosAtualizados')); }
    });

    function renderizarItensNf() {
        const container = document.getElementById('nf-itens-container');
        container.innerHTML = '';
        if (nfItens.length === 0) {
            container.innerHTML = '<p class="placeholder">Adicione produtos à nota...</p>';
        } else {
            nfItens.forEach((item, index) => {
                const itemDiv = document.createElement('div');
                itemDiv.className = 'nf-item';
                itemDiv.innerHTML = `
                    <span>${item.quantidade}x ${item.nome}</span>
                    <strong>R$ ${(item.quantidade * item.preco_unitario_momento).toFixed(2)}</strong>
                    <button type="button" class="btn-remover-ingrediente" onclick="removerItemNf(${index})">❌</button>
                `;
                container.appendChild(itemDiv);
            });
        }
        const total = nfItens.reduce((acc, item) => acc + (item.quantidade * item.preco_unitario_momento), 0);
        document.getElementById('nf-valor-total').textContent = `R$ ${total.toFixed(2)}`;
    }

    window.removerItemNf = function(index) {
        nfItens.splice(index, 1);
        renderizarItensNf();
    }
    
    function resetarFormularioNf() {
        nfItens = [];
        renderizarItensNf();
        formAddNfItem.reset();
        formDadosNf.reset();
    }

    formAddNfItem.addEventListener('submit', (event) => {
        event.preventDefault();
        const produtoId = document.getElementById('nf-produto').value;
        if (!produtoId) return showNotification('Selecione um produto.', 'error');

        const produtoSelecionado = produtosData.find(p => p.id == produtoId);
        if (!produtoSelecionado.preco_venda) return showNotification('Este produto não foi precificado.', 'error');
        
        nfItens.push({
            produto_id: parseInt(produtoId, 10),
            nome: produtoSelecionado.nome,
            quantidade: parseFloat(document.getElementById('nf-quantidade').value),
            preco_unitario_momento: parseFloat(produtoSelecionado.preco_venda)
        });
        renderizarItensNf();
        formAddNfItem.reset();
        document.getElementById('nf-produto').focus();
    });

    btnSalvarNf.addEventListener('click', async () => {
        if (nfItens.length === 0) return showNotification('Adicione pelo menos um produto à nota.', 'error');
        const clienteId = document.getElementById('nf-cliente').value;
        if (!clienteId) return showNotification('Selecione um cliente.', 'error');

        const valorTotal = nfItens.reduce((acc, item) => acc + (item.quantidade * item.preco_unitario_momento), 0);
        
        const { data: notaFiscal, error } = await supabaseClient.from('notas_fiscais').insert([{
            cliente_id: parseInt(clienteId, 10),
            valor_total: valorTotal,
            status_pagamento: document.getElementById('nf-status-pagamento').value,
            metodo_pagamento: document.getElementById('nf-metodo-pagamento').value
        }]).select().single();

        if (error) {
            console.error('Erro ao salvar nota fiscal:', error);
            return showNotification('Erro ao salvar a nota fiscal.', 'error');
        }

        const itensParaSalvar = nfItens.map(item => ({
            nota_fiscal_id: notaFiscal.id,
            produto_id: item.produto_id,
            quantidade: item.quantidade,
            preco_unitario_momento: item.preco_unitario_momento
        }));

        const { error: errorItens } = await supabaseClient.from('nota_fiscal_itens').insert(itensParaSalvar);

        if (errorItens) {
            console.error('Erro ao salvar itens da nota:', errorItens);
            showNotification('Erro ao salvar os itens da nota. A nota principal foi criada mas está vazia.', 'error');
        } else {
            showNotification('Nota Fiscal salva com sucesso!');
            resetarFormularioNf();
            document.dispatchEvent(new CustomEvent('dadosAtualizados'));
            document.querySelector('#tela-notas-saida .sub-nav-link[data-target="subtela-historico-saida"]').click();
        }
    });

    function renderizarItensNe() {
        const container = document.getElementById('ne-itens-container');
        container.innerHTML = '';
        if (neItens.length === 0) {
            container.innerHTML = '<p class="placeholder">Adicione insumos à nota...</p>';
        } else {
            neItens.forEach((item, index) => {
                const itemDiv = document.createElement('div');
                itemDiv.className = 'nf-item';
                itemDiv.innerHTML = `
                    <span>${item.quantidade} x ${item.nome} (R$ ${item.preco_unitario_momento.toFixed(2)})</span>
                    <strong>R$ ${(item.quantidade * item.preco_unitario_momento).toFixed(2)}</strong>
                    <button type="button" class="btn-remover-ingrediente" onclick="removerItemNe(${index})">❌</button>
                `;
                container.appendChild(itemDiv);
            });
        }
        const total = neItens.reduce((acc, item) => acc + (item.quantidade * item.preco_unitario_momento), 0);
        document.getElementById('ne-valor-total').textContent = `R$ ${total.toFixed(2)}`;
    }

    window.removerItemNe = function(index) {
        neItens.splice(index, 1);
        renderizarItensNe();
    }
    
    function resetarFormularioNe() {
        neItens = [];
        renderizarItensNe();
        formAddNeItem.reset();
        formDadosNe.reset();
        document.getElementById('ne-data').valueAsDate = new Date();
    }

    formAddNeItem.addEventListener('submit', (event) => {
        event.preventDefault();
        const insumoId = document.getElementById('ne-insumo').value;
        const preco = parseFloat(document.getElementById('ne-preco').value);

        if (!insumoId || !preco || preco <= 0) {
            return showNotification('Selecione um insumo e preencha um preço válido.', 'error');
        }
        
        const insumoSelecionado = insumosData.find(i => i.id == insumoId);
        
        neItens.push({
            insumo_id: parseInt(insumoId, 10),
            nome: insumoSelecionado.nome,
            quantidade: parseFloat(document.getElementById('ne-quantidade').value),
            preco_unitario_momento: preco
        });
        renderizarItensNe();
        formAddNeItem.reset();
        document.getElementById('ne-insumo').focus();
    });

    btnSalvarNe.addEventListener('click', async () => {
        if (neItens.length === 0) return showNotification('Adicione pelo menos um insumo à nota.', 'error');
        const fornecedorId = document.getElementById('ne-fornecedor').value;
        if (!fornecedorId) return showNotification('Selecione um fornecedor.', 'error');

        showNotification("Funcionalidade de salvar Nota de Entrada em desenvolvimento.", "info");
        resetarFormularioNe();
    });
    
    function displayNotasFiscais() {
        const corpoTabela = document.getElementById('corpo-tabela-notas-saida');
        if (!corpoTabela) return;
        corpoTabela.innerHTML = '';

        const filtroBusca = document.getElementById('filtro-busca').value.toLowerCase();
        const filtroDataInicio = document.getElementById('filtro-data-inicio').value;
        const filtroDataFim = document.getElementById('filtro-data-fim').value;

        const filteredData = notasFiscaisData.filter(nf => {
            const buscaCliente = nf.contatos?.nome_razao_social.toLowerCase().includes(filtroBusca);
            const buscaId = nf.id.toString().includes(filtroBusca);
            
            const dataNota = new Date(nf.created_at);
            dataNota.setHours(0,0,0,0);
            const dataInicio = filtroDataInicio ? new Date(filtroDataInicio + 'T00:00:00Z') : null;
            const dataFim = filtroDataFim ? new Date(filtroDataFim + 'T23:59:59Z') : null;

            const atendeBusca = filtroBusca ? (buscaCliente || buscaId) : true;
            const atendeDataInicio = dataInicio ? dataNota >= dataInicio : true;
            const atendeDataFim = dataFim ? dataNota <= dataFim : true;

            return atendeBusca && atendeDataInicio && atendeDataFim;
        });

        filteredData.sort((a, b) => {
            let valA, valB;
            if (sortColumn === 'cliente') {
                valA = a.contatos?.nome_razao_social.toLowerCase() || '';
                valB = b.contatos?.nome_razao_social.toLowerCase() || '';
            } else {
                valA = a[sortColumn];
                valB = b[sortColumn];
            }
            
            if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
            if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
            return 0;
        });

        const startIndex = (currentPage - 1) * rowsPerPage;
        const endIndex = startIndex + rowsPerPage;
        const paginatedData = filteredData.slice(startIndex, endIndex);

        if (paginatedData.length === 0) {
            corpoTabela.innerHTML = '<tr><td colspan="5">Nenhuma nota fiscal encontrada com os filtros atuais.</td></tr>';
        } else {
            renderizarTabelaNotasFiscais(paginatedData);
        }

        renderizarPaginacao(filteredData.length);
        atualizarCabecalhoOrdenacao();
    }

    function renderizarTabelaNotasFiscais(notas) {
        const corpoTabela = document.getElementById('corpo-tabela-notas-saida');
        corpoTabela.innerHTML = ''; 
        notas.forEach(nf => {
            const tr = document.createElement('tr');
            const statusClass = nf.status_pagamento === 'Pago' ? 'status-pago' : 'status-pendente';
            tr.innerHTML = `
                <td>${new Date(nf.created_at).toLocaleDateString('pt-BR')}</td>
                <td>${nf.contatos ? nf.contatos.nome_razao_social : 'Cliente removido'}</td>
                <td>R$ ${Number(nf.valor_total).toFixed(2)}</td>
                <td><span class="status ${statusClass}">${nf.status_pagamento}</span></td>
                <td class="actions-container">
                    <button class="btn-acao btn-info" title="Ver Detalhes" onclick="verDetalhesNota(${nf.id})">👁️</button>
                    <button class="btn-acao btn-warning" title="Editar Nota" onclick="editarNotaSaida(${nf.id})">✏️</button>
                    ${nf.status_pagamento !== 'Pago' ? `<button class="btn-acao btn-success" title="Marcar como Pago" onclick="marcarComoPago(${nf.id})">✔️</button>` : ''}
                    <button class="btn-acao btn-danger" title="Deletar Nota" onclick="deletarNota(${nf.id})">🗑️</button>
                </td>
            `;
            corpoTabela.appendChild(tr);
        });
    }

    function renderizarPaginacao(totalItens) {
        const container = document.getElementById('paginacao-botoes');
        const infoContainer = document.getElementById('total-itens-info');
        if (!container || !infoContainer) return;
        container.innerHTML = '';
        infoContainer.textContent = `(Total: ${totalItens})`;

        const totalPages = Math.ceil(totalItens / rowsPerPage);
        if (totalPages <= 1) return;

        for (let i = 1; i <= totalPages; i++) {
            const button = document.createElement('button');
            button.textContent = i;
            if (i === currentPage) button.classList.add('active');
            button.addEventListener('click', () => {
                currentPage = i;
                displayNotasFiscais();
            });
            container.appendChild(button);
        }
    }
    
    function atualizarCabecalhoOrdenacao() {
        document.querySelectorAll('th.sortable').forEach(th => {
            const span = th.querySelector('span');
            if(!span) return;
            span.textContent = '';
            if (th.dataset.sort === sortColumn) {
                span.textContent = sortDirection === 'asc' ? '▲' : '▼';
            }
        });
    }

    document.getElementById('filtro-busca').addEventListener('input', () => { currentPage = 1; displayNotasFiscais(); });
    document.getElementById('filtro-data-inicio').addEventListener('change', () => { currentPage = 1; displayNotasFiscais(); });
    document.getElementById('filtro-data-fim').addEventListener('change', () => { currentPage = 1; displayNotasFiscais(); });
    document.getElementById('rows-per-page').addEventListener('change', (e) => {
        currentPage = 1;
        rowsPerPage = parseInt(e.target.value, 10);
        displayNotasFiscais();
    });
    document.getElementById('btn-limpar-filtros').addEventListener('click', () => {
        document.getElementById('filtro-busca').value = '';
        document.getElementById('filtro-data-inicio').value = '';
        document.getElementById('filtro-data-fim').value = '';
        currentPage = 1;
        sortColumn = 'created_at';
        sortDirection = 'desc';
        displayNotasFiscais();
    });
    document.querySelectorAll('#tela-notas-saida th.sortable').forEach(th => {
        th.addEventListener('click', () => {
            const newSortColumn = th.dataset.sort;
            if (sortColumn === newSortColumn) {
                sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
            } else {
                sortColumn = newSortColumn;
                sortDirection = 'asc';
            }
            currentPage = 1;
            displayNotasFiscais();
        });
    });

    async function atualizarTodosOsDados() {
        const [insumosResult, produtosResult, contatosResult, notasResult] = await Promise.all([
            supabaseClient.from('insumos').select('*').order('nome'),
            supabaseClient.from('produtos').select('*').order('nome'),
            supabaseClient.from('contatos').select('*').order('nome_razao_social'),
            supabaseClient.from('notas_fiscais').select(`*, contatos(nome_razao_social)`)
        ]);
        
        insumosData = insumosResult.data || [];
        produtosData = produtosResult.data || [];
        contatosData = contatosResult.data || [];
        notasFiscaisData = notasResult.data || [];
        
        renderizarTabelaInsumos();
        renderizarTabelaProdutos();
        renderizarTabelaContatos();
        
        const selectInsumo = document.getElementById('select-insumo-receita');
        const selectProdutoNf = document.getElementById('nf-produto');
        const selectClienteNf = document.getElementById('nf-cliente');
        const selectNeInsumo = document.getElementById('ne-insumo');
        const selectNeFornecedor = document.getElementById('ne-fornecedor');
        const editNsCliente = document.getElementById('edit-ns-cliente');
        const editNsProduto = document.getElementById('edit-ns-produto');

        [selectInsumo, selectProdutoNf, selectClienteNf, selectNeInsumo, selectNeFornecedor, editNsCliente, editNsProduto].forEach(sel => sel.innerHTML = '');
        
        selectInsumo.innerHTML = '<option value="">Selecione...</option>';
        selectProdutoNf.innerHTML = '<option value="">Selecione um produto...</option>';
        selectClienteNf.innerHTML = '<option value="">Selecione um cliente...</option>';
        selectNeInsumo.innerHTML = '<option value="">Selecione um insumo...</option>';
        selectNeFornecedor.innerHTML = '<option value="">Selecione um fornecedor...</option>';
        editNsCliente.innerHTML = '<option value="">Selecione um cliente...</option>';
        editNsProduto.innerHTML = '<option value="">Selecione um produto...</option>';
        
        insumosData.forEach(i => {
            selectInsumo.innerHTML += `<option value="${i.id}">${i.nome}</option>`;
            selectNeInsumo.innerHTML += `<option value="${i.id}">${i.nome}</option>`;
        });

        produtosData.filter(p => p.preco_venda > 0).forEach(p => {
            selectProdutoNf.innerHTML += `<option value="${p.id}">${p.nome} - R$ ${Number(p.preco_venda).toFixed(2)}</option>`;
            editNsProduto.innerHTML += `<option value="${p.id}">${p.nome} - R$ ${Number(p.preco_venda).toFixed(2)}</option>`;
        });
        
        const clientes = contatosData.filter(c => parsePapeis(c.papeis).includes('Cliente'));
        clientes.forEach(c => {
            selectClienteNf.innerHTML += `<option value="${c.id}">${c.nome_razao_social}</option>`;
            editNsCliente.innerHTML += `<option value="${c.id}">${c.nome_razao_social}</option>`;
        });

        const fornecedores = contatosData.filter(c => parsePapeis(c.papeis).includes('Fornecedor'));
        fornecedores.forEach(f => selectNeFornecedor.innerHTML += `<option value="${f.id}">${f.nome_razao_social}</option>`);
        
        document.getElementById('ne-data').valueAsDate = new Date();
        displayNotasFiscais();
    }
    
    document.addEventListener('dadosAtualizados', atualizarTodosOsDados);
    
    mostrarTela('tela-dashboard');
    atualizarTodosOsDados();
    atualizarLabelsFormularioContato();
});